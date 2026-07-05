(function () {
  "use strict";

  const app = document.querySelector("#app");
  const navButtons = Array.from(document.querySelectorAll("[data-nav]"));

  let plots = HatakeData.loadPlots();
  let workRecords = HatakeData.loadWorkRecords();
  let schedules = HatakeData.loadSchedules();
  let selectedPhotoFiles = [];
  let selectedPhotoPreviewUrls = [];
  let activePhotoUrls = [];
  let flashMessage = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) {
      return "未設定";
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }).format(date);
  }

  function todayValue() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function setFlashMessage(message) {
    flashMessage = message;
  }

  function flashMessageHtml() {
    if (!flashMessage) {
      return "";
    }

    const message = flashMessage;
    flashMessage = "";
    return `
      <div class="panel form-message">
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  function workRecordPhotoIds(record) {
    return Array.isArray(record.photoIds) ? record.photoIds : [];
  }

  function findWorkRecord(workRecordId) {
    return workRecords.find((record) => record.id === workRecordId);
  }

  function releasePhotoObjectUrls() {
    activePhotoUrls.forEach((url) => URL.revokeObjectURL(url));
    activePhotoUrls = [];
  }

  function createPhotoObjectUrl(blob) {
    const url = URL.createObjectURL(blob);
    activePhotoUrls.push(url);
    return url;
  }

  function photoStripHtml(photoIds) {
    if (!photoIds.length) {
      return "";
    }

    return `
      <div class="photo-strip" data-photo-ids="${escapeHtml(photoIds.join(","))}">
        <p class="empty-text">写真を読み込み中です。</p>
      </div>
    `;
  }

  function setRoute(route) {
    window.location.hash = route;
  }

  function getRoute() {
    return window.location.hash.replace(/^#/, "") || "home";
  }

  function setActiveNav(route) {
    navButtons.forEach((button) => {
      const nav = button.dataset.nav;
      const isActive =
        (nav === "home" && route === "home") ||
        (nav === "plots" && (route === "plots" || route.startsWith("plot/"))) ||
        (nav === "work" && route === "work-new") ||
        (nav === "schedules" && (route === "schedules" || route === "schedule-new")) ||
        (nav === "new" && route === "plot-new");

      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-current", isActive ? "page" : "false");
    });
  }

  function findPlot(plotId) {
    return plots.find((plot) => plot.id === plotId);
  }

  function sortWorkRecordsByDate(records) {
    return [...records].sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  }

  function workRecordCardHtml(record) {
    const plot = findPlot(record.plotId);
    const plotName = plot ? plot.name : "削除済みの区画";
    const cropName = plot ? plot.cropName : "作物未設定";
    const photoIds = workRecordPhotoIds(record);

    return `
      <article class="card work-record-card">
        <div class="work-record-card__top">
          <div>
            <p class="work-date">${escapeHtml(formatDate(record.date))}</p>
            <p class="work-type">${escapeHtml(record.workType)}</p>
          </div>
          <span class="status-badge">${escapeHtml(plotName)}</span>
        </div>
        <p class="work-plot">${escapeHtml(cropName)}</p>
        <p class="work-memo">${escapeHtml(record.memo || "メモはありません。")}</p>
        ${photoStripHtml(photoIds)}
      </article>
    `;
  }

  function workRecordListHtml(records, emptyMessage) {
    if (!records.length) {
      return `
        <div class="panel panel--empty">
          <p class="empty-text">${escapeHtml(emptyMessage)}</p>
        </div>
      `;
    }

    return `<div class="work-record-list">${records.map(workRecordCardHtml).join("")}</div>`;
  }

  function sortSchedulesForList(items) {
    return [...items].sort((a, b) => {
      const doneCompare = Number(Boolean(a.done)) - Number(Boolean(b.done));

      if (doneCompare !== 0) {
        return doneCompare;
      }

      const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
  }

  function sortUpcomingSchedules(items) {
    return sortSchedulesForList(items.filter((schedule) => !schedule.done));
  }

  function scheduleCardHtml(schedule, options = {}) {
    const plot = findPlot(schedule.plotId);
    const plotName = plot ? plot.name : "削除済みの区画";
    const cropName = plot ? plot.cropName : "作物未設定";
    const showPlot = options.showPlot !== false;
    const showMemo = options.showMemo !== false;
    const showCheckbox = options.showCheckbox !== false;
    const scheduleId = escapeHtml(schedule.id);
    const checkboxId = `schedule-done-${scheduleId}`;

    return `
      <article class="card schedule-card ${schedule.done ? "is-done" : ""}">
        <div class="schedule-card__top">
          <div>
            <p class="schedule-date">${escapeHtml(formatDate(schedule.date))}</p>
            <p class="schedule-title">${escapeHtml(schedule.title)}</p>
          </div>
          ${schedule.done ? `<span class="status-badge">完了</span>` : `<span class="status-badge">未完了</span>`}
        </div>
        ${showPlot ? `<p class="schedule-plot">${escapeHtml(plotName)} / ${escapeHtml(cropName)}</p>` : ""}
        ${showMemo ? `<p class="schedule-memo">${escapeHtml(schedule.memo || "メモはありません。")}</p>` : ""}
        ${
          showCheckbox
            ? `
              <label class="schedule-check" for="${checkboxId}">
                <input class="schedule-checkbox" id="${checkboxId}" type="checkbox" data-action="toggle-schedule-done" data-id="${scheduleId}" ${schedule.done ? "checked" : ""}>
                <span>完了</span>
              </label>
            `
            : ""
        }
      </article>
    `;
  }

  function scheduleListHtml(items, emptyMessage, options = {}) {
    if (!items.length) {
      return `
        <div class="panel panel--empty">
          <p class="empty-text">${escapeHtml(emptyMessage)}</p>
        </div>
      `;
    }

    return `<div class="schedule-list">${items.map((schedule) => scheduleCardHtml(schedule, options)).join("")}</div>`;
  }

  async function hydratePhotoStrips() {
    const strips = Array.from(app.querySelectorAll("[data-photo-ids]"));

    await Promise.all(strips.map(async (strip) => {
      const photoIds = String(strip.dataset.photoIds || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (!photoIds.length) {
        strip.innerHTML = "";
        return;
      }

      try {
        const photos = await HatakeData.getPhotosByIds(photoIds);

        if (!photos.length) {
          strip.innerHTML = `<p class="empty-text">写真を読み込めませんでした。</p>`;
          return;
        }

        strip.innerHTML = photos.map((photo) => {
          const url = createPhotoObjectUrl(photo.blob);
          return `
            <button class="photo-thumb-button" type="button" data-action="open-photo" data-photo-url="${escapeHtml(url)}">
              <img class="photo-thumb" src="${escapeHtml(url)}" alt="作業記録の写真">
            </button>
          `;
        }).join("");
      } catch (error) {
        console.error("写真サムネイルの読み込みに失敗しました。", error);
        strip.innerHTML = `<p class="empty-text">写真機能を使用できません。</p>`;
      }
    }));
  }

  async function hydratePhotoGallery() {
    const gallery = app.querySelector("[data-photo-gallery-plot-id]");

    if (!gallery) {
      return;
    }

    const plotId = gallery.dataset.photoGalleryPlotId;

    try {
      const photos = await HatakeData.getPhotosByPlotId(plotId);

      if (!photos.length) {
        gallery.innerHTML = `<div class="panel panel--empty"><p class="empty-text">この区画の写真はまだありません。作業記録に写真を添付するとここに表示されます。</p></div>`;
        return;
      }

      gallery.innerHTML = photos.map((photo) => {
        const record = findWorkRecord(photo.workRecordId);
        const url = createPhotoObjectUrl(photo.blob);
        const recordDate = record ? formatDate(record.date) : formatDate(photo.createdAt?.slice(0, 10));
        const workType = record ? record.workType : "作業記録";

        return `
          <article class="card photo-gallery-card">
            <button class="photo-thumb-button photo-thumb-button--large" type="button" data-action="open-photo" data-photo-url="${escapeHtml(url)}">
              <img class="photo-thumb photo-thumb--large" src="${escapeHtml(url)}" alt="写真記録">
            </button>
            <div>
              <p class="work-date">${escapeHtml(recordDate)}</p>
              <p class="work-type">${escapeHtml(workType)}</p>
            </div>
          </article>
        `;
      }).join("");
    } catch (error) {
      console.error("写真記録の読み込みに失敗しました。", error);
      gallery.innerHTML = `<div class="panel panel--empty"><p class="empty-text">写真機能を使用できません。IndexedDBが無効または利用できない可能性があります。</p></div>`;
    }
  }

  function hydratePhotoElements() {
    releasePhotoObjectUrls();
    hydratePhotoStrips();
    hydratePhotoGallery();
  }

  function openPhotoModal(photoUrl) {
    closePhotoModal();
    const modal = document.createElement("div");
    modal.className = "photo-modal";
    modal.innerHTML = `
      <div class="photo-modal__backdrop" data-action="close-photo"></div>
      <div class="photo-modal__content" role="dialog" aria-modal="true" aria-label="写真の拡大表示">
        <button class="photo-modal__close" type="button" data-action="close-photo">閉じる</button>
        <img src="${escapeHtml(photoUrl)}" alt="拡大写真">
      </div>
    `;
    document.body.appendChild(modal);
  }

  function closePhotoModal() {
    const modal = document.querySelector(".photo-modal");

    if (modal) {
      modal.remove();
    }
  }

  function plotCardHtml(plot) {
    return `
      <button class="plot-card" type="button" data-action="open-plot" data-id="${escapeHtml(plot.id)}">
        <div class="plot-card__top">
          <div>
            <p class="plot-name">${escapeHtml(plot.name)}</p>
            <p class="crop-name">${escapeHtml(plot.cropName || "作物未設定")}</p>
          </div>
          <span class="status-badge" data-status="${escapeHtml(plot.status)}">${escapeHtml(plot.status)}</span>
        </div>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">植え付け日</span>
            <span class="meta-value">${escapeHtml(formatDate(plot.plantingDate))}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">収穫予定日</span>
            <span class="meta-value">${escapeHtml(formatDate(plot.harvestDate))}</span>
          </div>
        </div>
      </button>
    `;
  }

  function fieldValue(plot, key, fallback = "") {
    return escapeHtml(plot ? plot[key] || fallback : fallback);
  }

  function renderHome() {
    const recentPlots = plots.slice(0, 3);
    const recentWorkRecords = sortWorkRecordsByDate(workRecords).slice(0, 5);
    const upcomingSchedules = sortUpcomingSchedules(schedules).slice(0, 5);

    app.innerHTML = `
      <section class="view">
        ${flashMessageHtml()}
        <div class="panel panel--soft">
          <h2>畑ノート</h2>
          <p>区画ごとに作物や状態を記録する、スマホ向けのローカル管理アプリです。</p>
          <div class="home-actions">
            <button class="btn btn--primary" type="button" data-action="go-plots">区画一覧を見る</button>
            <button class="btn" type="button" data-action="go-work-new">作業記録を追加する</button>
            <button class="btn" type="button" data-action="go-schedule-new">予定を追加する</button>
            <button class="btn btn--subtle" type="button" data-action="go-new">区画を追加する</button>
          </div>
        </div>

        <section class="section" aria-labelledby="home-plots-title">
          <h2 id="home-plots-title">登録中の区画</h2>
          ${
            recentPlots.length
              ? `<div class="plot-list">${recentPlots.map(plotCardHtml).join("")}</div>`
              : `<div class="panel panel--empty"><p class="empty-text">まだ区画がありません。</p></div>`
          }
        </section>

        <section class="section" aria-labelledby="home-work-title">
          <h2 id="home-work-title">最近の作業記録</h2>
          ${workRecordListHtml(recentWorkRecords, "まだ記録がありません。下部の「記録」から作業記録を追加できます。")}
        </section>

        <section class="section" aria-labelledby="home-plan-title">
          <h2 id="home-plan-title">今日・近日中にやる予定</h2>
          ${scheduleListHtml(upcomingSchedules, "未完了の予定はまだありません。予定画面から追加できます。", { showMemo: false, showCheckbox: false })}
        </section>
      </section>
    `;
    hydratePhotoElements();
  }

  function renderPlotList() {
    app.innerHTML = `
      <section class="view">
        <div class="detail-header">
          <div>
            <h2>畑区画一覧</h2>
            <p class="empty-text">${plots.length}件の区画があります。</p>
          </div>
        </div>
        <button class="btn btn--primary" type="button" data-action="go-new">区画を追加する</button>
        ${
          plots.length
            ? `<div class="plot-list">${plots.map(plotCardHtml).join("")}</div>`
            : `<div class="panel panel--empty"><p class="empty-text">まだ区画がありません。</p></div>`
        }
      </section>
    `;
  }

  function detailItem(label, value) {
    return `
      <div class="panel">
        <h3>${escapeHtml(label)}</h3>
        <p class="memo-text">${escapeHtml(value || "未設定")}</p>
      </div>
    `;
  }

  function renderPlotDetail(plotId) {
    const plot = findPlot(plotId);

    if (!plot) {
      app.innerHTML = `
        <section class="view">
          <div class="panel panel--empty">
            <h2>区画が見つかりません</h2>
            <p class="empty-text">保存済みデータから対象の区画を見つけられませんでした。</p>
          </div>
          <button class="btn btn--primary" type="button" data-action="go-plots">区画一覧へ戻る</button>
        </section>
      `;
      return;
    }

    const plotWorkRecords = sortWorkRecordsByDate(
      workRecords.filter((record) => record.plotId === plot.id)
    ).slice(0, 5);
    const plotSchedules = sortUpcomingSchedules(
      schedules.filter((schedule) => schedule.plotId === plot.id)
    );

    app.innerHTML = `
      <section class="view">
        ${flashMessageHtml()}
        <div class="panel">
          <div class="detail-header">
            <div>
              <h2 class="detail-title">${escapeHtml(plot.name)}</h2>
              <p class="detail-crop">${escapeHtml(plot.cropName || "作物未設定")}</p>
            </div>
            <span class="status-badge" data-status="${escapeHtml(plot.status)}">${escapeHtml(plot.status)}</span>
          </div>
          <div class="button-row">
            <button class="btn btn--primary" type="button" data-action="edit-plot" data-id="${escapeHtml(plot.id)}">編集する</button>
            <button class="btn" type="button" data-action="go-plots">一覧へ戻る</button>
          </div>
        </div>

        <div class="detail-grid">
          ${detailItem("植え付け日", formatDate(plot.plantingDate))}
          ${detailItem("収穫予定日", formatDate(plot.harvestDate))}
          ${detailItem("メモ", plot.memo || "メモはまだありません。")}
        </div>

        <section class="section" aria-labelledby="detail-work-title">
          <h2 id="detail-work-title">最近の作業記録</h2>
          ${workRecordListHtml(plotWorkRecords, "この区画の作業記録はまだありません。下部の「記録」から追加できます。")}
        </section>

        <section class="section" aria-labelledby="detail-photo-title">
          <h2 id="detail-photo-title">写真記録</h2>
          <div class="photo-gallery" data-photo-gallery-plot-id="${escapeHtml(plot.id)}">
            <div class="panel panel--empty">
              <p class="empty-text">写真を読み込み中です。</p>
            </div>
          </div>
        </section>

        <section class="section" aria-labelledby="detail-plan-title">
          <h2 id="detail-plan-title">次にやる予定</h2>
          ${scheduleListHtml(plotSchedules, "この区画の未完了予定はまだありません。予定画面から追加できます。", { showPlot: false })}
        </section>
      </section>
    `;
    hydratePhotoElements();
  }

  function statusOptions(selectedStatus) {
    return HatakeData.PLOT_STATUSES.map((status) => {
      const selected = status === selectedStatus ? "selected" : "";
      return `<option value="${escapeHtml(status)}" ${selected}>${escapeHtml(status)}</option>`;
    }).join("");
  }

  function workTypeOptions(selectedWorkType) {
    return HatakeData.WORK_TYPES.map((workType) => {
      const selected = workType === selectedWorkType ? "selected" : "";
      return `<option value="${escapeHtml(workType)}" ${selected}>${escapeHtml(workType)}</option>`;
    }).join("");
  }

  function plotOptions(selectedPlotId) {
    return plots.map((plot) => {
      const selected = plot.id === selectedPlotId ? "selected" : "";
      const label = `${plot.name}：${plot.cropName || "作物未設定"}`;
      return `<option value="${escapeHtml(plot.id)}" ${selected}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderPlotForm(plotId) {
    const isEdit = Boolean(plotId);
    const plot = isEdit ? findPlot(plotId) : null;

    if (isEdit && !plot) {
      renderPlotDetail(plotId);
      return;
    }

    const defaultStatus = plot ? plot.status : "育成中";

    app.innerHTML = `
      <section class="view">
        <div>
          <h2>${isEdit ? "区画を編集" : "区画を追加"}</h2>
          <p class="empty-text">区画名と作物名を入れると、一覧と詳細画面に表示されます。</p>
        </div>

        <form class="form" id="plot-form" novalidate>
          <input type="hidden" name="id" value="${fieldValue(plot, "id")}">

          <div class="field">
            <label for="plot-name">区画名</label>
            <input id="plot-name" name="name" type="text" value="${fieldValue(plot, "name")}" required maxlength="40" autocomplete="off" placeholder="例：A区画">
          </div>

          <div class="field">
            <label for="crop-name">作物名</label>
            <input id="crop-name" name="cropName" type="text" value="${fieldValue(plot, "cropName")}" required maxlength="40" autocomplete="off" placeholder="例：さつまいも">
          </div>

          <div class="field">
            <label for="planting-date">植え付け日</label>
            <input id="planting-date" name="plantingDate" type="date" value="${fieldValue(plot, "plantingDate", isEdit ? "" : todayValue())}">
          </div>

          <div class="field">
            <label for="harvest-date">収穫予定日</label>
            <input id="harvest-date" name="harvestDate" type="date" value="${fieldValue(plot, "harvestDate")}">
          </div>

          <div class="field">
            <label for="plot-status">状態</label>
            <select id="plot-status" name="status">
              ${statusOptions(defaultStatus)}
            </select>
          </div>

          <div class="field">
            <label for="plot-memo">メモ</label>
            <textarea id="plot-memo" name="memo" maxlength="500" placeholder="土の状態、日当たり、気になることなど">${fieldValue(plot, "memo")}</textarea>
            <p class="form-help">500文字まで保存できます。</p>
          </div>

          <div class="button-row">
            <button class="btn btn--primary" type="button" data-action="save-plot">保存する</button>
            <button class="btn" type="button" data-action="${isEdit ? "cancel-edit" : "go-plots"}" ${isEdit ? `data-id="${escapeHtml(plot.id)}"` : ""}>キャンセル</button>
          </div>
        </form>
      </section>
    `;

    const firstInput = app.querySelector("#plot-name");
    if (firstInput) {
      firstInput.focus();
    }
  }

  function renderWorkRecordForm() {
    clearSelectedPhotos();

    if (!plots.length) {
      app.innerHTML = `
        <section class="view">
          <div class="panel panel--empty">
            <h2>作業記録を追加</h2>
            <p class="empty-text">作業記録は区画に紐づけて保存します。先に区画を追加してください。</p>
          </div>
          <button class="btn btn--primary" type="button" data-action="go-new">区画を追加する</button>
        </section>
      `;
      return;
    }

    app.innerHTML = `
      <section class="view">
        <div>
          <h2>作業記録を追加</h2>
          <p class="empty-text">作業した区画を選んで、日付と内容を記録します。</p>
        </div>

        <form class="form" id="work-form" novalidate>
          <div class="field">
            <label for="work-date">日付</label>
            <input id="work-date" name="date" type="date" value="${escapeHtml(todayValue())}" required>
          </div>

          <div class="field">
            <label for="work-plot">区画</label>
            <select id="work-plot" name="plotId" required>
              ${plotOptions(plots[0].id)}
            </select>
          </div>

          <div class="field">
            <label for="work-type">作業内容</label>
            <select id="work-type" name="workType" required>
              ${workTypeOptions("水やり")}
            </select>
          </div>

          <div class="field">
            <label for="work-memo">メモ</label>
            <textarea id="work-memo" name="memo" maxlength="500" placeholder="作業した量、気づいたこと、次に見ることなど"></textarea>
            <p class="form-help">500文字まで保存できます。</p>
          </div>

          <div class="field">
            <label for="work-photos">写真</label>
            <input id="work-photos" name="photos" type="file" accept="image/*" multiple>
            <p class="form-help">1つの作業記録につき最大3枚まで保存できます。保存前に縮小します。</p>
            <div class="form-message" id="photo-message" aria-live="polite"></div>
            <div class="photo-preview-grid" id="photo-preview"></div>
          </div>

          <div class="button-row">
            <button class="btn btn--primary" type="button" data-action="save-work-record">保存する</button>
            <button class="btn" type="button" data-action="go-home">キャンセル</button>
          </div>
        </form>
      </section>
    `;

    const firstInput = app.querySelector("#work-date");
    if (firstInput) {
      firstInput.focus();
    }
  }

  function clearSelectedPhotos() {
    selectedPhotoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    selectedPhotoPreviewUrls = [];
    selectedPhotoFiles = [];
  }

  function setPhotoMessage(message) {
    const messageArea = app.querySelector("#photo-message");

    if (messageArea) {
      messageArea.textContent = message;
      messageArea.classList.toggle("is-visible", Boolean(message));
    }
  }

  function renderSelectedPhotoPreview() {
    const preview = app.querySelector("#photo-preview");

    if (!preview) {
      return;
    }

    selectedPhotoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    selectedPhotoPreviewUrls = [];

    if (!selectedPhotoFiles.length) {
      preview.innerHTML = "";
      return;
    }

    preview.innerHTML = selectedPhotoFiles.map((file, index) => {
      const url = URL.createObjectURL(file);
      selectedPhotoPreviewUrls.push(url);
      return `
        <figure class="photo-preview">
          <img src="${escapeHtml(url)}" alt="選択した写真${index + 1}">
          <figcaption>${index + 1}枚目</figcaption>
        </figure>
      `;
    }).join("");
  }

  function handlePhotoSelection(input) {
    const files = Array.from(input.files || []).filter((file) => file.type.startsWith("image/"));

    if (files.length > 3) {
      selectedPhotoFiles = files.slice(0, 3);
      setPhotoMessage("写真は最大3枚までです。先頭の3枚だけを保存対象にしました。");
    } else {
      selectedPhotoFiles = files;
      setPhotoMessage("");
    }

    renderSelectedPhotoPreview();
  }

  function resizeImageFile(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const maxSize = 1200;
        const scale = Math.min(1, maxSize / image.width, maxSize / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("画像の縮小処理を開始できませんでした。"));
          return;
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("画像のJPEG変換に失敗しました。"));
            return;
          }

          resolve(blob);
        }, "image/jpeg", 0.8);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("画像を読み込めませんでした。"));
      };

      image.src = objectUrl;
    });
  }

  async function buildPhotoRecords(files, workRecordId, plotId) {
    const now = new Date().toISOString();
    const resizedBlobs = await Promise.all(files.map((file) => resizeImageFile(file)));

    return resizedBlobs.map((blob) => ({
      id: HatakeData.createPhotoId(),
      workRecordId,
      plotId,
      blob,
      createdAt: now
    }));
  }

  function renderScheduleList() {
    const sortedSchedules = sortSchedulesForList(schedules);

    app.innerHTML = `
      <section class="view">
        <div class="detail-header">
          <div>
            <h2>育成スケジュール</h2>
            <p class="empty-text">${schedules.length}件の予定があります。</p>
          </div>
        </div>
        <button class="btn btn--primary" type="button" data-action="go-schedule-new">予定を追加する</button>
        ${scheduleListHtml(sortedSchedules, "まだ予定がありません。予定を追加するとここに表示されます。")}
      </section>
    `;
  }

  function renderScheduleForm() {
    if (!plots.length) {
      app.innerHTML = `
        <section class="view">
          <div class="panel panel--empty">
            <h2>予定を追加</h2>
            <p class="empty-text">育成スケジュールは区画に紐づけて保存します。先に区画を追加してください。</p>
          </div>
          <button class="btn btn--primary" type="button" data-action="go-new">区画を追加する</button>
        </section>
      `;
      return;
    }

    app.innerHTML = `
      <section class="view">
        <div>
          <h2>予定を追加</h2>
          <p class="empty-text">区画ごとの次にやる作業を予定として登録します。</p>
        </div>

        <form class="form" id="schedule-form" novalidate>
          <div class="field">
            <label for="schedule-plot">区画</label>
            <select id="schedule-plot" name="plotId" required>
              ${plotOptions(plots[0].id)}
            </select>
          </div>

          <div class="field">
            <label for="schedule-title">作業予定名</label>
            <input id="schedule-title" name="title" type="text" required maxlength="60" autocomplete="off" placeholder="例：つる返し">
          </div>

          <div class="field">
            <label for="schedule-date">予定日</label>
            <input id="schedule-date" name="date" type="date" value="${escapeHtml(todayValue())}" required>
          </div>

          <div class="field">
            <label for="schedule-memo">メモ</label>
            <textarea id="schedule-memo" name="memo" maxlength="500" placeholder="作業の目安、見るポイント、必要な道具など"></textarea>
            <p class="form-help">500文字まで保存できます。</p>
          </div>

          <div class="button-row">
            <button class="btn btn--primary" type="button" data-action="save-schedule">保存する</button>
            <button class="btn" type="button" data-action="go-schedules">キャンセル</button>
          </div>
        </form>
      </section>
    `;

    const firstInput = app.querySelector("#schedule-title");
    if (firstInput) {
      firstInput.focus();
    }
  }

  function savePlotFromForm(form) {
    const formData = new FormData(form);
    const id = String(formData.get("id") || "");
    const now = new Date().toISOString();
    const existingPlot = id ? findPlot(id) : null;

    const name = String(formData.get("name") || "").trim();
    const cropName = String(formData.get("cropName") || "").trim();

    if (!name || !cropName) {
      alert("区画名と作物名を入力してください。");
      return;
    }

    const plot = {
      id: existingPlot ? existingPlot.id : HatakeData.createPlotId(),
      name,
      cropName,
      plantingDate: String(formData.get("plantingDate") || ""),
      harvestDate: String(formData.get("harvestDate") || ""),
      status: String(formData.get("status") || "育成中"),
      memo: String(formData.get("memo") || "").trim(),
      createdAt: existingPlot ? existingPlot.createdAt : now,
      updatedAt: now
    };

    if (existingPlot) {
      plots = plots.map((item) => (item.id === plot.id ? plot : item));
    } else {
      plots = [plot, ...plots];
    }

    HatakeData.savePlots(plots);
    setRoute(`plot/${plot.id}`);
  }

  async function saveWorkRecordFromForm(form) {
    const formData = new FormData(form);
    const now = new Date().toISOString();
    const plotId = String(formData.get("plotId") || "");
    const date = String(formData.get("date") || "");
    const workType = String(formData.get("workType") || "");
    const workRecordId = HatakeData.createWorkRecordId();
    let photoIds = [];

    if (!date || !plotId || !workType) {
      alert("日付、区画、作業内容を入力してください。");
      return;
    }

    if (!findPlot(plotId)) {
      alert("選択した区画が見つかりません。区画一覧を確認してください。");
      return;
    }

    if (selectedPhotoFiles.length) {
      try {
        const photos = await buildPhotoRecords(selectedPhotoFiles, workRecordId, plotId);
        await HatakeData.savePhotos(photos);
        photoIds = photos.map((photo) => photo.id);
      } catch (error) {
        console.error("写真の保存に失敗しました。", error);
        photoIds = [];
        setFlashMessage("写真の保存に失敗したため、写真なしの作業記録として保存しました。IndexedDBが使えない場合もアプリ本体は利用できます。");
      }
    }

    const workRecord = {
      id: workRecordId,
      plotId,
      date,
      workType,
      memo: String(formData.get("memo") || "").trim(),
      photoIds,
      createdAt: now,
      updatedAt: now
    };

    workRecords = [workRecord, ...workRecords];
    HatakeData.saveWorkRecords(workRecords);
    clearSelectedPhotos();
    setRoute(`plot/${plotId}`);
  }

  function saveScheduleFromForm(form) {
    const formData = new FormData(form);
    const now = new Date().toISOString();
    const plotId = String(formData.get("plotId") || "");
    const title = String(formData.get("title") || "").trim();
    const date = String(formData.get("date") || "");

    if (!plotId || !title || !date) {
      alert("区画、作業予定名、予定日を入力してください。");
      return;
    }

    if (!findPlot(plotId)) {
      alert("選択した区画が見つかりません。区画一覧を確認してください。");
      return;
    }

    const schedule = {
      id: HatakeData.createScheduleId(),
      plotId,
      title,
      date,
      memo: String(formData.get("memo") || "").trim(),
      done: false,
      createdAt: now,
      updatedAt: now
    };

    schedules = [schedule, ...schedules];
    HatakeData.saveSchedules(schedules);
    setRoute("schedules");
  }

  function updateScheduleDone(scheduleId, done) {
    const now = new Date().toISOString();
    let changed = false;

    schedules = schedules.map((schedule) => {
      if (schedule.id !== scheduleId) {
        return schedule;
      }

      changed = true;
      return {
        ...schedule,
        done,
        updatedAt: now
      };
    });

    if (!changed) {
      return;
    }

    HatakeData.saveSchedules(schedules);
    render();
  }

  function handleClick(event) {
    const target = event.target.closest("[data-action], [data-nav]");
    if (!target) {
      return;
    }

    const action = target.dataset.action;
    const nav = target.dataset.nav;

    if (nav === "home") setRoute("home");
    if (nav === "plots") setRoute("plots");
    if (nav === "work") setRoute("work-new");
    if (nav === "schedules") setRoute("schedules");
    if (nav === "new") setRoute("plot-new");

    if (action === "go-home") setRoute("home");
    if (action === "go-plots") setRoute("plots");
    if (action === "go-schedules") setRoute("schedules");
    if (action === "go-new") setRoute("plot-new");
    if (action === "go-work-new") setRoute("work-new");
    if (action === "go-schedule-new") setRoute("schedule-new");
    if (action === "open-photo") openPhotoModal(target.dataset.photoUrl);
    if (action === "close-photo") closePhotoModal();
    if (action === "open-plot") setRoute(`plot/${target.dataset.id}`);
    if (action === "edit-plot") setRoute(`plot-edit/${target.dataset.id}`);
    if (action === "cancel-edit") setRoute(`plot/${target.dataset.id}`);
    if (action === "save-plot") {
      const form = target.closest("#plot-form");
      if (form) {
        savePlotFromForm(form);
      }
    }
    if (action === "save-work-record") {
      const form = target.closest("#work-form");
      if (form) {
        saveWorkRecordFromForm(form);
      }
    }
    if (action === "save-schedule") {
      const form = target.closest("#schedule-form");
      if (form) {
        saveScheduleFromForm(form);
      }
    }
  }

  function handleSubmit(event) {
    if (event.target.id === "plot-form") {
      event.preventDefault();
      savePlotFromForm(event.target);
    }

    if (event.target.id === "work-form") {
      event.preventDefault();
      saveWorkRecordFromForm(event.target);
    }

    if (event.target.id === "schedule-form") {
      event.preventDefault();
      saveScheduleFromForm(event.target);
    }
  }

  function handleChange(event) {
    const target = event.target;

    if (target.matches("#work-photos")) {
      handlePhotoSelection(target);
      return;
    }

    if (target.matches('[data-action="toggle-schedule-done"]')) {
      updateScheduleDone(target.dataset.id, target.checked);
    }
  }

  function render() {
    const route = getRoute();
    setActiveNav(route);

    if (route === "home") {
      renderHome();
      return;
    }

    if (route === "plots") {
      renderPlotList();
      return;
    }

    if (route === "plot-new") {
      renderPlotForm();
      return;
    }

    if (route === "work-new") {
      renderWorkRecordForm();
      return;
    }

    if (route === "schedules") {
      renderScheduleList();
      return;
    }

    if (route === "schedule-new") {
      renderScheduleForm();
      return;
    }

    if (route.startsWith("plot-edit/")) {
      renderPlotForm(route.replace("plot-edit/", ""));
      return;
    }

    if (route.startsWith("plot/")) {
      renderPlotDetail(route.replace("plot/", ""));
      return;
    }

    setRoute("home");
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
  window.addEventListener("hashchange", render);
  render();
})();
