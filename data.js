(function () {
  "use strict";

  const STORAGE_KEY = "hatakeNoteLocal.plots.v1";
  const WORK_RECORDS_STORAGE_KEY = "hatakeNoteLocal.workRecords.v1";
  const SCHEDULES_STORAGE_KEY = "hatakeNoteLocal.schedules.v1";
  const LAYOUT_STORAGE_KEY = "hatakeNoteLocal.layout.v1";
  const LAYOUT_V2_STORAGE_KEY = "hatakeNoteLocal.layout.v2";
  const CROP_PLANS_STORAGE_KEY = "hatakeNoteLocal.cropPlans.v1";
  const LAYOUT_CELL_COUNT = 16;
  const LAYOUT_ROWS = 4;
  const LAYOUT_COLS = 4;
  const PHOTO_DB_NAME = "hatakeNoteLocalDB";
  const PHOTO_STORE_NAME = "photos";

  const PLOT_STATUSES = ["準備中", "育成中", "収穫中", "終了", "休耕中"];
  const WORK_TYPES = ["水やり", "草取り", "植え付け", "追肥", "剪定", "支柱", "防虫", "収穫", "片付け", "その他"];
  const CROP_PLAN_STATUSES = ["予定", "栽培中", "完了"];

  const SAMPLE_PLOTS = [
    {
      id: "plot_sample_a",
      name: "A区画",
      cropName: "さつまいも",
      plantingDate: "2026-05-10",
      harvestDate: "2026-10-20",
      status: "育成中",
      memo: "初期サンプルです。日当たりのよい区画として登録しています。",
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z"
    },
    {
      id: "plot_sample_b",
      name: "B区画",
      cropName: "トマト",
      plantingDate: "2026-04-25",
      harvestDate: "2026-07-20",
      status: "収穫中",
      memo: "支柱を立てて管理する想定のサンプルです。",
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z"
    },
    {
      id: "plot_sample_c",
      name: "C区画",
      cropName: "ナス",
      plantingDate: "2026-05-01",
      harvestDate: "2026-08-10",
      status: "育成中",
      memo: "追肥や剪定を記録していく想定のサンプルです。",
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z"
    },
    {
      id: "plot_sample_flower",
      name: "花壇",
      cropName: "日々草",
      plantingDate: "2026-06-01",
      harvestDate: "",
      status: "育成中",
      memo: "花壇管理用のサンプルです。",
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z"
    },
    {
      id: "plot_sample_pot",
      name: "鉢植え",
      cropName: "ブルーベリー",
      plantingDate: "2026-03-15",
      harvestDate: "2026-07-30",
      status: "育成中",
      memo: "鉢植え管理用のサンプルです。",
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z"
    }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadPlots() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const samples = clone(SAMPLE_PLOTS);
      savePlots(samples);
      return samples;
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("区画データの読み込みに失敗しました。", error);
      return [];
    }
  }

  function savePlots(plots) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plots));
  }

  function loadWorkRecords() {
    const raw = localStorage.getItem(WORK_RECORDS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("作業記録データの読み込みに失敗しました。", error);
      return [];
    }
  }

  function saveWorkRecords(workRecords) {
    localStorage.setItem(WORK_RECORDS_STORAGE_KEY, JSON.stringify(workRecords));
  }

  function loadSchedules() {
    const raw = localStorage.getItem(SCHEDULES_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("育成スケジュールデータの読み込みに失敗しました。", error);
      return [];
    }
  }

  function saveSchedules(schedules) {
    localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
  }

  function normalizeCropPlanPrepDays(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
      return 0;
    }

    return Math.floor(number);
  }

  function normalizeCropPlan(plan) {
    const status = CROP_PLAN_STATUSES.includes(plan?.status) ? plan.status : "予定";

    return {
      id: String(plan?.id || ""),
      plotId: String(plan?.plotId || ""),
      cropName: String(plan?.cropName || ""),
      startDate: String(plan?.startDate || ""),
      endDate: String(plan?.endDate || ""),
      memo: String(plan?.memo || ""),
      status,
      plantingMethod: String(plan?.plantingMethod || ""),
      prepDaysBeforeStart: normalizeCropPlanPrepDays(plan?.prepDaysBeforeStart),
      createdAt: String(plan?.createdAt || ""),
      updatedAt: String(plan?.updatedAt || "")
    };
  }

  function loadCropPlans() {
    const raw = localStorage.getItem(CROP_PLANS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map(normalizeCropPlan).filter((plan) => plan.id && plan.plotId && plan.cropName)
        : [];
    } catch (error) {
      console.error("栽培計画データの読み込みに失敗しました。", error);
      return [];
    }
  }

  function saveCropPlans(cropPlans) {
    localStorage.setItem(CROP_PLANS_STORAGE_KEY, JSON.stringify(cropPlans.map(normalizeCropPlan)));
  }

  function createLayoutCells(plotIds = []) {
    return Array.from({ length: LAYOUT_CELL_COUNT }, (_, index) => ({
      cellId: `cell-${index + 1}`,
      plotId: plotIds[index] || null
    }));
  }

  function normalizeLayout(layout) {
    return Array.from({ length: LAYOUT_CELL_COUNT }, (_, index) => {
      const cellId = `cell-${index + 1}`;
      const sourceCell = Array.isArray(layout)
        ? layout.find((cell) => cell && cell.cellId === cellId) || layout[index]
        : null;
      const plotId = typeof sourceCell?.plotId === "string" && sourceCell.plotId
        ? sourceCell.plotId
        : null;

      return { cellId, plotId };
    });
  }

  function createInitialLayout(plots = []) {
    const plotIds = Array.isArray(plots)
      ? plots.map((plot) => plot.id).filter(Boolean)
      : [];

    return createLayoutCells(plotIds);
  }

  function loadLayout(plots = []) {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);

    if (!raw) {
      const initialLayout = createInitialLayout(plots);
      saveLayout(initialLayout);
      return initialLayout;
    }

    try {
      const parsed = JSON.parse(raw);
      return normalizeLayout(parsed);
    } catch (error) {
      console.error("畑レイアウトデータの読み込みに失敗しました。", error);
      return createInitialLayout(plots);
    }
  }

  function saveLayout(layout) {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(normalizeLayout(layout)));
  }

  function normalizeLayoutV2Cell(cell, index) {
    const cellNumber = index + 1;
    const cellId = `cell-${cellNumber}`;

    return {
      cellId,
      cellNumber,
      plotId: typeof cell?.plotId === "string" && cell.plotId ? cell.plotId : null,
      groupId: typeof cell?.groupId === "string" && cell.groupId ? cell.groupId : null
    };
  }

  function normalizeLayoutV2(layoutV2, fallbackLayout = []) {
    const fallbackCells = Array.isArray(fallbackLayout) ? normalizeLayout(fallbackLayout) : createLayoutCells();
    const sourceCells = Array.isArray(layoutV2?.cells) ? layoutV2.cells : fallbackCells;
    const cells = Array.from({ length: LAYOUT_CELL_COUNT }, (_, index) => {
      const cellId = `cell-${index + 1}`;
      const sourceCell = sourceCells.find((cell) => cell && cell.cellId === cellId) || sourceCells[index] || fallbackCells[index];
      return normalizeLayoutV2Cell(sourceCell, index);
    });
    const validCellIds = new Set(cells.map((cell) => cell.cellId));
    const groups = Array.isArray(layoutV2?.groups)
      ? layoutV2.groups.map((group) => {
        const cellIds = Array.isArray(group?.cellIds)
          ? group.cellIds.filter((cellId) => validCellIds.has(cellId))
          : [];

        return {
          id: String(group?.id || ""),
          cellIds: [...new Set(cellIds)],
          plotId: typeof group?.plotId === "string" && group.plotId ? group.plotId : null,
          label: String(group?.label || ""),
          memo: String(group?.memo || ""),
          createdAt: String(group?.createdAt || ""),
          updatedAt: String(group?.updatedAt || "")
        };
      }).filter((group) => group.id && group.cellIds.length)
      : [];
    const cellGroupMap = new Map();
    groups.forEach((group) => {
      group.cellIds.forEach((cellId) => {
        cellGroupMap.set(cellId, group.id);
      });
    });
    cells.forEach((cell) => {
      const groupId = cellGroupMap.get(cell.cellId) || null;
      const group = groups.find((item) => item.id === groupId);
      cell.groupId = groupId;

      if (group) {
        cell.plotId = group.plotId;
      }
    });

    return {
      version: 2,
      rows: LAYOUT_ROWS,
      cols: LAYOUT_COLS,
      cells,
      groups
    };
  }

  function createLayoutV2FromLayout(layout = []) {
    const v1Cells = normalizeLayout(layout);

    return normalizeLayoutV2({
      version: 2,
      rows: LAYOUT_ROWS,
      cols: LAYOUT_COLS,
      cells: v1Cells.map((cell, index) => ({
        cellId: cell.cellId,
        cellNumber: index + 1,
        plotId: cell.plotId,
        groupId: null
      })),
      groups: []
    }, v1Cells);
  }

  function createInitialLayoutV2(plots = []) {
    return createLayoutV2FromLayout(createInitialLayout(plots));
  }

  function loadLayoutV2(plots = []) {
    const rawV2 = localStorage.getItem(LAYOUT_V2_STORAGE_KEY);

    if (rawV2) {
      try {
        return normalizeLayoutV2(JSON.parse(rawV2));
      } catch (error) {
        console.error("畑レイアウトv2データの読み込みに失敗しました。", error);
      }
    }

    const rawV1 = localStorage.getItem(LAYOUT_STORAGE_KEY);
    let initialLayoutV2 = null;

    if (rawV1) {
      try {
        initialLayoutV2 = createLayoutV2FromLayout(JSON.parse(rawV1));
      } catch (error) {
        console.error("畑レイアウトv1からv2への移行に失敗しました。", error);
      }
    }

    if (!initialLayoutV2) {
      initialLayoutV2 = createInitialLayoutV2(plots);
    }

    saveLayoutV2(initialLayoutV2);
    return initialLayoutV2;
  }

  function saveLayoutV2(layoutV2) {
    localStorage.setItem(LAYOUT_V2_STORAGE_KEY, JSON.stringify(normalizeLayoutV2(layoutV2)));
  }

  function createPlotId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `plot_${window.crypto.randomUUID()}`;
    }

    return `plot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function createWorkRecordId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `work_${window.crypto.randomUUID()}`;
    }

    return `work_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function createScheduleId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `schedule_${window.crypto.randomUUID()}`;
    }

    return `schedule_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function createCropPlanId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `crop_plan_${window.crypto.randomUUID()}`;
    }

    return `crop_plan_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function createPhotoId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `photo_${window.crypto.randomUUID()}`;
    }

    return `photo_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function createLayoutGroupId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `layout_group_${window.crypto.randomUUID()}`;
    }

    return `layout_group_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function openPhotoDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("このブラウザではIndexedDBを使用できません。"));
        return;
      }

      const request = window.indexedDB.open(PHOTO_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
          const store = db.createObjectStore(PHOTO_STORE_NAME, { keyPath: "id" });
          store.createIndex("workRecordId", "workRecordId", { unique: false });
          store.createIndex("plotId", "plotId", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDBの接続に失敗しました。"));
      request.onblocked = () => reject(new Error("IndexedDBの更新がブロックされました。"));
    });
  }

  function savePhotos(photos) {
    if (!photos.length) {
      return Promise.resolve();
    }

    return openPhotoDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE_NAME, "readwrite");
      const store = transaction.objectStore(PHOTO_STORE_NAME);

      photos.forEach((photo) => store.put(photo));

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("写真の保存に失敗しました。"));
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error || new Error("写真の保存が中断されました。"));
      };
    }));
  }

  function getPhoto(photoId) {
    return openPhotoDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE_NAME, "readonly");
      const store = transaction.objectStore(PHOTO_STORE_NAME);
      const request = store.get(photoId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("写真の読み込みに失敗しました。"));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    }));
  }

  function getPhotosByIds(photoIds) {
    return Promise.all(photoIds.map((photoId) => getPhoto(photoId)))
      .then((photos) => photos.filter(Boolean));
  }

  function getPhotosByPlotId(plotId) {
    return openPhotoDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE_NAME, "readonly");
      const store = transaction.objectStore(PHOTO_STORE_NAME);
      const index = store.index("plotId");
      const request = index.getAll(plotId);

      request.onsuccess = () => {
        const photos = Array.isArray(request.result) ? request.result : [];
        resolve(photos.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
      };
      request.onerror = () => reject(request.error || new Error("写真の読み込みに失敗しました。"));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    }));
  }

  function getAllPhotos() {
    return openPhotoDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE_NAME, "readonly");
      const store = transaction.objectStore(PHOTO_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const photos = Array.isArray(request.result) ? request.result : [];
        resolve(photos.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
      };
      request.onerror = () => reject(request.error || new Error("写真の読み込みに失敗しました。"));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    }));
  }

  function deletePhotos(photoIds) {
    const ids = Array.isArray(photoIds) ? photoIds.filter(Boolean) : [];

    if (!ids.length) {
      return Promise.resolve();
    }

    return openPhotoDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE_NAME, "readwrite");
      const store = transaction.objectStore(PHOTO_STORE_NAME);

      ids.forEach((photoId) => store.delete(photoId));

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("写真の削除に失敗しました。"));
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error || new Error("写真の削除が中断されました。"));
      };
    }));
  }

  function updatePhotosPlot(photoIds, plotId) {
    const ids = Array.isArray(photoIds) ? photoIds.filter(Boolean) : [];

    if (!ids.length) {
      return Promise.resolve();
    }

    return openPhotoDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE_NAME, "readwrite");
      const store = transaction.objectStore(PHOTO_STORE_NAME);

      ids.forEach((photoId) => {
        const request = store.get(photoId);

        request.onsuccess = () => {
          const photo = request.result;

          if (photo) {
            store.put({ ...photo, plotId });
          }
        };
      });

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("写真情報の更新に失敗しました。"));
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error || new Error("写真情報の更新が中断されました。"));
      };
    }));
  }

  function replacePhotos(photos) {
    const items = Array.isArray(photos) ? photos : [];

    return openPhotoDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE_NAME, "readwrite");
      const store = transaction.objectStore(PHOTO_STORE_NAME);

      store.clear();
      items.forEach((photo) => store.put(photo));

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("写真の復元に失敗しました。"));
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error || new Error("写真の復元が中断されました。"));
      };
    }));
  }

  window.HatakeData = {
    STORAGE_KEY,
    WORK_RECORDS_STORAGE_KEY,
    SCHEDULES_STORAGE_KEY,
    LAYOUT_STORAGE_KEY,
    LAYOUT_V2_STORAGE_KEY,
    CROP_PLANS_STORAGE_KEY,
    PHOTO_DB_NAME,
    PHOTO_STORE_NAME,
    PLOT_STATUSES,
    WORK_TYPES,
    CROP_PLAN_STATUSES,
    loadPlots,
    savePlots,
    loadWorkRecords,
    saveWorkRecords,
    loadSchedules,
    saveSchedules,
    loadLayout,
    saveLayout,
    loadLayoutV2,
    saveLayoutV2,
    normalizeLayoutV2,
    createLayoutV2FromLayout,
    loadCropPlans,
    saveCropPlans,
    createPlotId,
    createWorkRecordId,
    createScheduleId,
    createCropPlanId,
    createPhotoId,
    createLayoutGroupId,
    savePhotos,
    getPhotosByIds,
    getPhotosByPlotId,
    getAllPhotos,
    deletePhotos,
    updatePhotosPlot,
    replacePhotos
  };
})();
