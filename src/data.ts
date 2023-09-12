import { Reference } from "model/ref";
import { Reminder, Reminders } from "model/reminder";
import { DateTime } from "model/time";
import type { Plugin_2 } from "obsidian";
import { SETTINGS, TAG_RESCAN } from "settings";

interface ReminderData {
  title: string;
  time: string;
  rowNumber: number;
}

export class PluginDataIO {

  private restoring = true;
  changed: boolean = false;
  public scanned: Reference<boolean> = new Reference(false);
  public debug: Reference<boolean> = new Reference(false);

  constructor(private plugin: Plugin_2, private reminders: Reminders) {
    SETTINGS.forEach(setting => {
      setting.rawValue.onChanged(() => {
        if (this.restoring) {
          return;
        }
        if (setting.hasTag(TAG_RESCAN)) {
          this.scanned.value = false;
        }
        this.changed = true;
      });
    })
  }

  async _getRemindersFromCache(): Promise<{[filePath: string]: Array<ReminderData>}> {
    const data = localStorage.getItem("reminders");
    if (!data) {
      return {};
    }
    return JSON.parse(data);
  }

  async _saveRemindersToCache(reminders: {[filePath: string]: Array<ReminderData>}) {
    localStorage.setItem("reminders", JSON.stringify(reminders));
  }

  async load() {
    console.debug("Load reminder plugin data");
    const data = await this.plugin.loadData();
    if (!data) {
      this.scanned.value = false;
      return;
    }
    this.scanned.value = data.scanned;
    if (data.debug != null) {
      this.debug.value = data.debug;
    }

    const loadedSettings = data.settings;
    SETTINGS.forEach(setting => {
      setting.load(loadedSettings);
    })

    data.reminders = await this._getRemindersFromCache();

    if (data.reminders) {
      Object.keys(data.reminders).forEach((filePath) => {
        const remindersInFile = data.reminders[filePath] as Array<ReminderData>;
        if (!remindersInFile) {
          return;
        }
        this.reminders.replaceFile(
          filePath,
          remindersInFile.map(
            (d) =>
              new Reminder(
                filePath,
                d.title,
                DateTime.parse(d.time),
                d.rowNumber,
                false
              )
          )
        );
      });
    }
    this.changed = false;
    if (this.restoring) {
      this.restoring = false;
    }
  }

  async save(force: boolean = false) {
    if (!force && !this.changed) {
      return;
    }
    console.debug(
      "Save reminder plugin data: force=%s, changed=%s",
      force,
      this.changed
    );
    const remindersData: any = {};
    this.reminders.fileToReminders.forEach((r, filePath) => {
      remindersData[filePath] = r.map((rr) => ({
        title: rr.title,
        time: rr.time.toString(),
        rowNumber: rr.rowNumber,
      }));
    });

    await this._saveRemindersToCache(remindersData);

    const settings = {};
    SETTINGS.forEach(setting => {
      setting.store(settings);
    })
    await this.plugin.saveData({
      scanned: this.scanned.value,
      debug: this.debug.value,
      settings
    });
    this.changed = false;
  }
}
