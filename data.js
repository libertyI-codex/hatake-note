(function () {
  "use strict";

  const STORAGE_KEY = "hatakeNoteV2.cropPlans.v1";
  const APP_NAME = "hatake-note-v2";
  const APP_VERSION = "2.0-prototype2";
  const BACKUP_VERSION = 1;
  const CELL_MIN = 1;
  const CELL_MAX = 16;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isDateValue(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function normalizeCellIds(cellIds) {
    if (!Array.isArray(cellIds)) {
      return [];
    }

    return [...new Set(cellIds.map(Number))]
      .filter(
        (cellId) =>
          Number.isInteger(cellId) && cellId >= CELL_MIN && cellId <= CELL_MAX,
      )
      .sort((a, b) => a - b);
  }

  function normalizeCropPlan(plan) {
    return {
      id: String(plan.id),
      cellIds: normalizeCellIds(plan.cellIds),
      cropName: String(plan.cropName).trim(),
      startDate: String(plan.startDate),
      endDate: String(plan.endDate),
      memo: String(plan.memo || "").trim(),
      createdAt: String(plan.createdAt),
      updatedAt: String(plan.updatedAt),
    };
  }

  function validateCropPlan(plan) {
    if (!isPlainObject(plan)) {
      return { valid: false, error: "作付けデータの形式が正しくありません。" };
    }

    if (typeof plan.id !== "string" || !plan.id.trim()) {
      return { valid: false, error: "作付けIDがありません。" };
    }

    if (!Array.isArray(plan.cellIds) || plan.cellIds.length === 0) {
      return { valid: false, error: "使用するマスがありません。" };
    }

    const validCellIds = plan.cellIds.every(
      (cellId) =>
        Number.isInteger(cellId) && cellId >= CELL_MIN && cellId <= CELL_MAX,
    );
    const uniqueCellIds = new Set(plan.cellIds);
    if (!validCellIds || uniqueCellIds.size !== plan.cellIds.length) {
      return {
        valid: false,
        error: "使用マスは1〜16の重複しない整数で指定してください。",
      };
    }

    if (typeof plan.cropName !== "string" || !plan.cropName.trim()) {
      return { valid: false, error: "作物名がありません。" };
    }

    if (!isDateValue(plan.startDate) || !isDateValue(plan.endDate)) {
      return { valid: false, error: "開始日または終了予定日が正しくありません。" };
    }

    if (plan.endDate < plan.startDate) {
      return {
        valid: false,
        error: "終了予定日は開始日以降にしてください。",
      };
    }

    if (
      typeof plan.createdAt !== "string" ||
      !plan.createdAt ||
      typeof plan.updatedAt !== "string" ||
      !plan.updatedAt
    ) {
      return { valid: false, error: "作成日時または更新日時がありません。" };
    }

    return { valid: true, error: "" };
  }

  function periodsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
    return firstStart <= secondEnd && secondStart <= firstEnd;
  }

  function findConflict(candidate, plans, ignoredId) {
    const candidateCells = new Set(normalizeCellIds(candidate.cellIds));

    for (const plan of plans) {
      if (plan.id === ignoredId) {
        continue;
      }

      if (
        !periodsOverlap(
          candidate.startDate,
          candidate.endDate,
          plan.startDate,
          plan.endDate,
        )
      ) {
        continue;
      }

      const conflictCellId = normalizeCellIds(plan.cellIds).find((cellId) =>
        candidateCells.has(cellId),
      );

      if (conflictCellId) {
        return {
          cellId: conflictCellId,
          plan: clone(plan),
        };
      }
    }

    return null;
  }

  function validatePlanCollection(plans) {
    if (!Array.isArray(plans)) {
      return { valid: false, error: "作付けデータが配列ではありません。" };
    }

    const normalizedPlans = [];
    const ids = new Set();

    for (let index = 0; index < plans.length; index += 1) {
      const result = validateCropPlan(plans[index]);
      if (!result.valid) {
        return {
          valid: false,
          error: `${index + 1}件目: ${result.error}`,
        };
      }

      const plan = normalizeCropPlan(plans[index]);
      if (ids.has(plan.id)) {
        return {
          valid: false,
          error: `${index + 1}件目: 作付けIDが重複しています。`,
        };
      }

      const conflict = findConflict(plan, normalizedPlans);
      if (conflict) {
        return {
          valid: false,
          error: `${index + 1}件目: マス${conflict.cellId}の使用期間が「${conflict.plan.cropName}」と重なっています。`,
        };
      }

      ids.add(plan.id);
      normalizedPlans.push(plan);
    }

    return { valid: true, error: "", plans: normalizedPlans };
  }

  function getCropPlans() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      const result = validatePlanCollection(parsed);
      if (!result.valid) {
        console.error(`保存データを読み込めません: ${result.error}`);
        return [];
      }
      return clone(result.plans);
    } catch (error) {
      console.error("保存データをJSONとして読み込めません。", error);
      return [];
    }
  }

  function saveCropPlans(plans) {
    const result = validatePlanCollection(plans);
    if (!result.valid) {
      throw new Error(result.error);
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.plans));
    return clone(result.plans);
  }

  function clearCropPlans() {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function createId() {
    const randomPart =
      window.crypto && typeof window.crypto.getRandomValues === "function"
        ? Array.from(window.crypto.getRandomValues(new Uint32Array(2)))
            .map((value) => value.toString(36))
            .join("")
        : Math.random().toString(36).slice(2, 12);

    return `crop-plan-${Date.now().toString(36)}-${randomPart}`;
  }

  function planStatusAtDate(plan, dateValue) {
    if (dateValue < plan.startDate) {
      return "今後の予定";
    }
    if (dateValue > plan.endDate) {
      return "終了済み";
    }
    return "栽培中";
  }

  function planAtCellOnDate(plans, cellId, dateValue) {
    return (
      plans.find(
        (plan) =>
          plan.cellIds.includes(cellId) &&
          plan.startDate <= dateValue &&
          plan.endDate >= dateValue,
      ) || null
    );
  }

  function planIntersectsYear(plan, year) {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return periodsOverlap(plan.startDate, plan.endDate, yearStart, yearEnd);
  }

  function planOverlapsMonth(plan, year, monthIndex) {
    const monthStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
    const monthEndDate = new Date(Date.UTC(year, monthIndex + 1, 0));
    const monthEnd = [
      monthEndDate.getUTCFullYear(),
      String(monthEndDate.getUTCMonth() + 1).padStart(2, "0"),
      String(monthEndDate.getUTCDate()).padStart(2, "0"),
    ].join("-");

    return periodsOverlap(plan.startDate, plan.endDate, monthStart, monthEnd);
  }

  function validateBackup(backup) {
    if (!isPlainObject(backup) || backup.appName !== APP_NAME) {
      return {
        valid: false,
        error: "畑ノート Ver.2.0のバックアップファイルではありません。",
      };
    }

    if (backup.backupVersion !== BACKUP_VERSION) {
      return {
        valid: false,
        error: "対応していないバックアップ形式です。",
      };
    }

    if (!Array.isArray(backup.cropPlans)) {
      return {
        valid: false,
        error: "バックアップ内の作付けデータが正しくありません。",
      };
    }

    const result = validatePlanCollection(backup.cropPlans);
    if (!result.valid) {
      return {
        valid: false,
        error: `バックアップ内の作付けデータが不正です。${result.error}`,
      };
    }

    return {
      valid: true,
      error: "",
      cropPlans: result.plans,
    };
  }

  window.HatakeNoteData = Object.freeze({
    STORAGE_KEY,
    APP_NAME,
    APP_VERSION,
    BACKUP_VERSION,
    CELL_MIN,
    CELL_MAX,
    createId,
    getCropPlans,
    saveCropPlans,
    clearCropPlans,
    validateCropPlan,
    validatePlanCollection,
    validateBackup,
    findConflict,
    periodsOverlap,
    planStatusAtDate,
    planAtCellOnDate,
    planIntersectsYear,
    planOverlapsMonth,
    normalizeCellIds,
  });
})();
