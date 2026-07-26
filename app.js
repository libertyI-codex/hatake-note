(function () {
  "use strict";

  const Data = window.HatakeNoteData;
  const app = document.getElementById("app");
  const dialog = document.getElementById("app-dialog");
  const dialogContent = document.getElementById("dialog-content");
  const toast = document.getElementById("toast");
  const navButtons = [...document.querySelectorAll("[data-route]")];

  const CROP_COLORS = [
    "#dceccf",
    "#f3dfb7",
    "#cfe4df",
    "#ead7c9",
    "#d8dfef",
    "#e8d9e8",
    "#d7e8b2",
    "#f0d5bd",
    "#cce1eb",
    "#e5e1bb",
  ];
  const FIELD_CELL_ORDER = [
    1, 5, 9, 13,
    2, 6, 10, 14,
    3, 7, 11, 15,
    4, 8, 12, 16,
  ];

  const state = {
    route: "field",
    plans: [],
    annualYear: Number(todayValue().slice(0, 4)),
    selectionMode: false,
    selectedCells: new Set(),
    formCellIds: new Set(),
    editingPlanId: null,
    pendingBackup: null,
    toastTimer: null,
  };

  function todayValue() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseDateValue(dateValue) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function dateToValue(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function addDays(dateValue, days) {
    const date = parseDateValue(dateValue);
    date.setDate(date.getDate() + days);
    return dateToValue(date);
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "未設定";
    }
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(parseDateValue(dateValue));
  }

  function formatDateLong(dateValue) {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(parseDateValue(dateValue));
  }

  function formatCellDate(dateValue) {
    const [, month, day] = dateValue.split("-").map(Number);
    return `${month}/${day}`;
  }

  function formatCells(cellIds) {
    return Data.normalizeCellIds(cellIds).join("・");
  }

  function colorForCrop(cropName) {
    let hash = 0;
    for (const character of cropName) {
      hash = (hash * 31 + character.codePointAt(0)) >>> 0;
    }
    return CROP_COLORS[hash % CROP_COLORS.length];
  }

  function showToast(message, tone = "success") {
    window.clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add("is-visible");
    state.toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  function setRoute(route) {
    state.route = route;
    state.selectionMode = false;
    state.selectedCells.clear();
    navButtons.forEach((button) => {
      const active = button.dataset.route === route;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function render() {
    if (state.route === "year") {
      renderYear();
      return;
    }

    if (state.route === "data") {
      renderData();
      return;
    }

    renderField();
  }

  function fieldDisplayForCell(cellId, referenceDate) {
    const currentPlan = Data.planAtCellOnDate(
      state.plans,
      cellId,
      referenceDate,
    );
    if (currentPlan) {
      return { plan: currentPlan, kind: "current" };
    }

    const nextPlan =
      state.plans
        .filter(
          (plan) =>
            plan.cellIds.includes(cellId) && plan.startDate > referenceDate,
        )
        .sort(
          (first, second) =>
            first.startDate.localeCompare(second.startDate) ||
            first.cropName.localeCompare(second.cropName, "ja"),
        )[0] || null;

    return nextPlan ? { plan: nextPlan, kind: "future" } : null;
  }

  function sharedEdgeClasses(cellId, display, displayByCell) {
    if (!display) {
      return "";
    }

    const classes = [];
    const row = (cellId - 1) % 4;
    const column = Math.floor((cellId - 1) / 4);
    const samePlan = (otherCellId) => {
      const otherDisplay = displayByCell.get(otherCellId);
      return (
        otherDisplay?.plan.id === display.plan.id &&
        otherDisplay?.kind === display.kind
      );
    };

    if (column > 0 && samePlan(cellId - 4)) {
      classes.push("joined-left");
    }
    if (column < 3 && samePlan(cellId + 4)) {
      classes.push("joined-right");
    }
    if (row > 0 && samePlan(cellId - 1)) {
      classes.push("joined-top");
    }
    if (row < 3 && samePlan(cellId + 1)) {
      classes.push("joined-bottom");
    }
    return classes.join(" ");
  }

  function fieldCellHtml(cellId, displayByCell) {
    const display = displayByCell.get(cellId);
    const plan = display?.plan || null;
    const selected = state.selectedCells.has(cellId);
    const style = plan
      ? `style="--crop-color:${colorForCrop(plan.cropName)}"`
      : "";
    const classes = [
      "field-cell",
      plan ? "has-plan" : "is-empty",
      display?.kind === "current" ? "is-current" : "",
      display?.kind === "future" ? "is-future" : "",
      selected ? "is-selected" : "",
      sharedEdgeClasses(cellId, display, displayByCell),
    ]
      .filter(Boolean)
      .join(" ");

    const displayLabel =
      display?.kind === "current"
        ? `${plan.cropName}、栽培中、${formatDate(plan.endDate)}終了予定`
        : display?.kind === "future"
          ? `次作予定、${plan.cropName}、${formatDate(plan.startDate)}開始`
          : "空き";
    const ariaLabel = state.selectionMode
      ? `マス${cellId}、${displayLabel}、${
          selected ? "選択中" : "未選択"
        }`
      : `マス${cellId}、${displayLabel}`;

    return `
      <button
        type="button"
        class="${classes}"
        data-cell-id="${cellId}"
        ${plan ? `data-plan-id="${escapeHtml(plan.id)}"` : ""}
        ${style}
        aria-label="${escapeHtml(ariaLabel)}"
        aria-pressed="${state.selectionMode ? String(selected) : "false"}"
      >
        <span class="cell-number">${cellId}</span>
        ${
          display?.kind === "current"
            ? `
              <span class="cell-status">栽培中</span>
              <span class="cell-crop" title="${escapeHtml(plan.cropName)}">${escapeHtml(
                plan.cropName,
              )}</span>
              <span class="cell-date">${escapeHtml(formatCellDate(plan.endDate))}終了</span>
            `
            : display?.kind === "future"
              ? `
                <span class="cell-status cell-status-next">次</span>
                <span class="cell-crop" title="${escapeHtml(plan.cropName)}">${escapeHtml(
                  plan.cropName,
                )}</span>
                <span class="cell-date">${escapeHtml(formatCellDate(plan.startDate))}開始</span>
              `
              : `<span class="cell-empty-label">空き</span>`
        }
        ${state.selectionMode ? '<span class="selection-mark" aria-hidden="true"></span>' : ""}
      </button>
    `;
  }

  function selectionToolbarHtml() {
    const selected = [...state.selectedCells].sort((a, b) => a - b);
    return `
      <section class="selection-panel" aria-labelledby="selection-title">
        <div>
          <p class="eyebrow">新しい作付け</p>
          <h3 id="selection-title">使用するマスを選択</h3>
          <p class="selection-summary" aria-live="polite">
            ${
              selected.length
                ? `選択中：${escapeHtml(formatCells(selected))}`
                : "マスを1つ以上タップしてください"
            }
          </p>
        </div>
        <div class="selection-actions">
          <button
            type="button"
            class="button button-subtle"
            data-action="selection-clear"
            ${selected.length ? "" : "disabled"}
          >
            すべて解除
          </button>
          <button type="button" class="button button-subtle" data-action="selection-cancel">
            キャンセル
          </button>
          <button
            type="button"
            class="button button-primary"
            data-action="selection-confirm"
            ${selected.length ? "" : "disabled"}
          >
            選択を確定
          </button>
        </div>
      </section>
    `;
  }

  function renderField() {
    const referenceDate = todayValue();
    const displayByCell = new Map(
      Array.from({ length: 16 }, (_, index) => {
        const cellId = index + 1;
        return [cellId, fieldDisplayForCell(cellId, referenceDate)];
      }),
    );

    app.innerHTML = `
      <section class="screen field-screen" aria-labelledby="field-title">
        <div class="screen-heading">
          <div>
            <p class="eyebrow">今日の畑</p>
            <h2 id="field-title">${escapeHtml(formatDateLong(referenceDate))}</h2>
          </div>
          <button type="button" class="button button-primary" data-action="new-plan">
            新しい作付け
          </button>
        </div>

        ${state.selectionMode ? selectionToolbarHtml() : ""}

        <div class="field-grid" aria-label="4×4の畑図">
          ${FIELD_CELL_ORDER.map((cellId) => fieldCellHtml(cellId, displayByCell)).join("")}
        </div>

        <p class="screen-note">
          栽培中の作物と、空いているマスの最も近い次作予定を表示しています。
        </p>
      </section>
    `;
  }

  function plansForCellMonth(cellId, monthIndex) {
    return state.plans
      .filter(
        (plan) =>
          plan.cellIds.includes(cellId) &&
          Data.planOverlapsMonth(plan, state.annualYear, monthIndex),
      )
      .sort(
        (first, second) =>
          first.startDate.localeCompare(second.startDate) ||
          first.endDate.localeCompare(second.endDate) ||
          first.cropName.localeCompare(second.cropName, "ja"),
      );
  }

  function yearMonthCellHtml(cellId, monthIndex) {
    const plans = plansForCellMonth(cellId, monthIndex);
    const month = monthIndex + 1;

    if (!plans.length) {
      return `
        <td class="month-cell is-empty" aria-label="マス${cellId} ${month}月 空き">
          <span class="month-empty-label">空き</span>
        </td>
      `;
    }

    return `
      <td class="month-cell" aria-label="マス${cellId} ${month}月 ${escapeHtml(
        plans.map((plan) => plan.cropName).join("、"),
      )}">
        <div class="month-plan-stack">
          ${plans
            .map(
              (plan) => `
                <button
                  type="button"
                  class="month-plan-label"
                  data-year-plan-id="${escapeHtml(plan.id)}"
                  style="--crop-color:${colorForCrop(plan.cropName)}"
                  title="${escapeHtml(
                    `${plan.cropName} ${formatDate(plan.startDate)}〜${formatDate(
                      plan.endDate,
                    )}`,
                  )}"
                  aria-label="${escapeHtml(
                    `${plan.cropName}、${formatDate(plan.startDate)}から${formatDate(
                      plan.endDate,
                    )}`,
                  )}"
                >
                  ${escapeHtml(plan.cropName)}
                </button>
              `,
            )
            .join("")}
        </div>
      </td>
    `;
  }

  function yearCellRowHtml(cellId) {
    return `
      <tr data-year-cell-id="${cellId}">
        <th scope="row" class="sticky-cell sticky-cells">マス${cellId}</th>
        ${Array.from({ length: 12 }, (_, monthIndex) =>
          yearMonthCellHtml(cellId, monthIndex),
        ).join("")}
      </tr>
    `;
  }

  function renderYear() {
    app.innerHTML = `
      <section class="screen year-screen" aria-labelledby="year-title">
        <div class="screen-heading">
          <div>
            <p class="eyebrow">年間予定</p>
            <h2 id="year-title">${state.annualYear}年</h2>
          </div>
          <button type="button" class="button button-primary" data-action="new-plan-from-year">
            新しい作付け
          </button>
        </div>

        <div class="year-controls" aria-label="表示年">
          <button type="button" class="icon-button" data-action="previous-year" aria-label="前年">
            ‹
          </button>
          <strong>${state.annualYear}年</strong>
          <button type="button" class="icon-button" data-action="next-year" aria-label="翌年">
            ›
          </button>
          <button type="button" class="button button-subtle" data-action="current-year">
            今年
          </button>
        </div>

        <div class="year-table-scroll" tabindex="0" aria-label="${state.annualYear}年の作付け表">
          <table class="year-table">
            <thead>
              <tr>
                <th class="sticky-cell sticky-cells">マス番号</th>
                ${Array.from(
                  { length: 12 },
                  (_, index) => `<th class="month-heading">${index + 1}月</th>`,
                ).join("")}
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: 16 }, (_, index) => yearCellRowHtml(index + 1)).join("")}
            </tbody>
          </table>
        </div>
        <p class="screen-note">
          表は横にスクロールできます。作物名をタップすると詳細を開きます。
        </p>
      </section>
    `;
  }

  function renderData() {
    const preview = state.pendingBackup
      ? `
        <div class="backup-preview" aria-live="polite">
          <p class="eyebrow">読み込み内容</p>
          <strong>作付け：${state.pendingBackup.cropPlans.length}件</strong>
          <p>復元すると、現在の${state.plans.length}件をこの内容で上書きします。</p>
          <button type="button" class="button button-primary" data-action="restore-backup">
            この内容で復元
          </button>
        </div>
      `
      : "";

    app.innerHTML = `
      <section class="screen data-screen" aria-labelledby="data-title">
        <div class="screen-heading">
          <div>
            <p class="eyebrow">保存と移行</p>
            <h2 id="data-title">データ管理</h2>
          </div>
          <span class="count-badge">作付け ${state.plans.length}件</span>
        </div>

        <section class="data-section" aria-labelledby="export-title">
          <h3 id="export-title">バックアップを書き出す</h3>
          <p>現在の作付けデータをJSONファイルに保存します。</p>
          <button type="button" class="button button-primary" data-action="export-backup">
            JSONを書き出す
          </button>
        </section>

        <section class="data-section" aria-labelledby="import-title">
          <h3 id="import-title">バックアップを読み込む</h3>
          <p>内容を確認してから、現在のデータを上書き復元します。</p>
          <label class="file-picker">
            <span>JSONファイルを選択</span>
            <input type="file" id="backup-file" accept=".json,application/json" />
          </label>
          <p id="import-error" class="form-error" role="alert"></p>
          ${preview}
        </section>

        <section class="data-section danger-section" aria-labelledby="delete-all-title">
          <h3 id="delete-all-title">全データ削除</h3>
          <p>この端末の作付けデータをすべて削除します。</p>
          <button type="button" class="button button-danger" data-action="delete-all">
            すべて削除
          </button>
        </section>
      </section>
    `;
  }

  function openDialog(html) {
    dialogContent.innerHTML = html;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog() {
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
    dialogContent.innerHTML = "";
    state.editingPlanId = null;
    state.formCellIds.clear();
  }

  function planDetailHtml(plan) {
    const referenceDate = todayValue();
    const status = Data.planStatusAtDate(plan, referenceDate);
    const statusClass =
      status === "栽培中" ? "status-active" : status === "今後の予定" ? "status-future" : "";

    return `
      <article class="dialog-panel" aria-labelledby="plan-detail-title">
        <div class="dialog-heading">
          <div>
            <p class="eyebrow">作付け詳細</p>
            <h2 id="plan-detail-title">${escapeHtml(plan.cropName)}</h2>
          </div>
          <span class="status-badge ${statusClass}">${escapeHtml(status)}</span>
        </div>

        <dl class="detail-list">
          <div><dt>使用マス</dt><dd>${escapeHtml(formatCells(plan.cellIds))}</dd></div>
          <div><dt>開始日</dt><dd>${escapeHtml(formatDate(plan.startDate))}</dd></div>
          <div><dt>終了予定日</dt><dd>${escapeHtml(formatDate(plan.endDate))}</dd></div>
          <div>
            <dt>${escapeHtml(formatDate(referenceDate))}時点</dt>
            <dd>${escapeHtml(status)}</dd>
          </div>
          <div class="detail-memo">
            <dt>メモ</dt>
            <dd>${plan.memo ? escapeHtml(plan.memo) : "なし"}</dd>
          </div>
        </dl>

        <div class="dialog-actions">
          <button type="button" class="button button-subtle" data-dialog-action="close">
            閉じる
          </button>
          <button
            type="button"
            class="button button-danger button-danger-quiet"
            data-dialog-action="delete-plan"
            data-plan-id="${escapeHtml(plan.id)}"
          >
            削除
          </button>
          <button
            type="button"
            class="button button-primary"
            data-dialog-action="edit-plan"
            data-plan-id="${escapeHtml(plan.id)}"
          >
            編集
          </button>
        </div>
      </article>
    `;
  }

  function showPlanDetail(planId) {
    const plan = state.plans.find((item) => item.id === planId);
    if (!plan) {
      showToast("作付けデータが見つかりません。", "error");
      return;
    }
    openDialog(planDetailHtml(plan));
  }

  function formCellButtonsHtml() {
    return FIELD_CELL_ORDER.map((cellId) => {
      const selected = state.formCellIds.has(cellId);
      return `
        <button
          type="button"
          class="form-cell ${selected ? "is-selected" : ""}"
          data-form-cell-id="${cellId}"
          aria-pressed="${String(selected)}"
          aria-label="マス${cellId}${selected ? " 選択中" : ""}"
        >
          ${cellId}
        </button>
      `;
    }).join("");
  }

  function openPlanForm(plan = null) {
    const isEdit = Boolean(plan);
    state.editingPlanId = plan?.id || null;
    state.formCellIds = new Set(
      plan ? plan.cellIds : [...state.selectedCells].sort((a, b) => a - b),
    );

    const startDate = plan?.startDate || todayValue();
    const endDate = plan?.endDate || addDays(startDate, 90);

    openDialog(`
      <form id="plan-form" class="dialog-panel plan-form" novalidate>
        <div class="dialog-heading">
          <div>
            <p class="eyebrow">${isEdit ? "作付けを変更" : "新しい作付け"}</p>
            <h2>${isEdit ? "作付けを編集" : "作付けを登録"}</h2>
          </div>
        </div>

        <fieldset class="form-fieldset">
          <legend>使用するマス <span class="required">必須</span></legend>
          <div class="form-cell-grid">${formCellButtonsHtml()}</div>
          <p id="form-cell-summary" class="field-help">
            ${
              state.formCellIds.size
                ? `選択中：${escapeHtml(formatCells([...state.formCellIds]))}`
                : "1マス以上選択してください"
            }
          </p>
        </fieldset>

        <label class="form-field">
          <span>作物名 <span class="required">必須</span></span>
          <input
            type="text"
            name="cropName"
            maxlength="40"
            autocomplete="off"
            required
            value="${escapeHtml(plan?.cropName || "")}"
            placeholder="例：じゃがいも"
          />
        </label>

        <div class="form-date-grid">
          <label class="form-field">
            <span>開始日 <span class="required">必須</span></span>
            <input type="date" name="startDate" required value="${escapeHtml(startDate)}" />
          </label>
          <label class="form-field">
            <span>終了予定日 <span class="required">必須</span></span>
            <input type="date" name="endDate" required value="${escapeHtml(endDate)}" />
          </label>
        </div>

        <label class="form-field">
          <span>メモ <span class="optional">任意</span></span>
          <textarea name="memo" rows="3" maxlength="300" placeholder="必要なことだけ記録">${escapeHtml(
            plan?.memo || "",
          )}</textarea>
        </label>

        <p id="plan-form-error" class="form-error" role="alert"></p>

        <div class="dialog-actions">
          <button type="button" class="button button-subtle" data-dialog-action="close">
            キャンセル
          </button>
          <button type="submit" class="button button-primary">
            ${isEdit ? "変更を保存" : "登録する"}
          </button>
        </div>
      </form>
    `);
  }

  function updateFormCellUi() {
    dialogContent.querySelectorAll("[data-form-cell-id]").forEach((button) => {
      const cellId = Number(button.dataset.formCellId);
      const selected = state.formCellIds.has(cellId);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute(
        "aria-label",
        `マス${cellId}${selected ? " 選択中" : ""}`,
      );
    });

    const summary = document.getElementById("form-cell-summary");
    if (summary) {
      summary.textContent = state.formCellIds.size
        ? `選択中：${formatCells([...state.formCellIds])}`
        : "1マス以上選択してください";
    }
  }

  function setFormError(message) {
    const errorElement = document.getElementById("plan-form-error");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.scrollIntoView({ block: "nearest" });
    }
  }

  function savePlanFromForm(form) {
    const formData = new FormData(form);
    const cropName = String(formData.get("cropName") || "").trim();
    const startDate = String(formData.get("startDate") || "");
    const endDate = String(formData.get("endDate") || "");
    const memo = String(formData.get("memo") || "").trim();
    const cellIds = [...state.formCellIds].sort((a, b) => a - b);

    if (!cellIds.length) {
      setFormError("使用するマスを1つ以上選択してください。");
      return;
    }
    if (!cropName) {
      setFormError("作物名を入力してください。");
      form.elements.cropName.focus();
      return;
    }
    if (!startDate || !endDate) {
      setFormError("開始日と終了予定日を入力してください。");
      return;
    }
    if (endDate < startDate) {
      setFormError("終了予定日は開始日以降にしてください。");
      form.elements.endDate.focus();
      return;
    }

    const existingPlan = state.editingPlanId
      ? state.plans.find((plan) => plan.id === state.editingPlanId)
      : null;
    const now = new Date().toISOString();
    const candidate = {
      id: existingPlan?.id || Data.createId(),
      cellIds,
      cropName,
      startDate,
      endDate,
      memo,
      createdAt: existingPlan?.createdAt || now,
      updatedAt: now,
    };

    const conflict = Data.findConflict(
      candidate,
      state.plans,
      existingPlan?.id || null,
    );
    if (conflict) {
      setFormError(
        `マス${conflict.cellId}は、${formatDate(
          conflict.plan.endDate,
        )}まで「${conflict.plan.cropName}」に使用されています。開始日または使用マスを変更してください。`,
      );
      return;
    }

    const nextPlans = existingPlan
      ? state.plans.map((plan) => (plan.id === existingPlan.id ? candidate : plan))
      : [...state.plans, candidate];

    try {
      state.plans = Data.saveCropPlans(nextPlans);
      state.selectionMode = false;
      state.selectedCells.clear();
      closeDialog();
      render();
      showToast(existingPlan ? "作付けを更新しました。" : "作付けを登録しました。");
    } catch (error) {
      setFormError(`保存できませんでした。${error.message}`);
    }
  }

  function deletePlan(planId) {
    const plan = state.plans.find((item) => item.id === planId);
    if (!plan) {
      closeDialog();
      return;
    }

    if (!window.confirm("この作付け予定を削除しますか？")) {
      return;
    }

    try {
      state.plans = Data.saveCropPlans(
        state.plans.filter((item) => item.id !== planId),
      );
      closeDialog();
      render();
      showToast("作付けを削除しました。");
    } catch (error) {
      showToast(`削除できませんでした。${error.message}`, "error");
    }
  }

  function beginNewPlan() {
    setRoute("field");
    state.selectionMode = true;
    state.selectedCells.clear();
    renderField();
  }

  function backupFileName() {
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("");
    const timePart = [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
    ].join("");
    return `hatake-note-v2-backup-${datePart}-${timePart}.json`;
  }

  function exportBackup() {
    const backup = {
      appName: Data.APP_NAME,
      backupVersion: Data.BACKUP_VERSION,
      appVersion: Data.APP_VERSION,
      exportedAt: new Date().toISOString(),
      cropPlans: state.plans,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = backupFileName();
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("バックアップを書き出しました。");
  }

  async function readBackupFile(file) {
    const errorElement = document.getElementById("import-error");
    state.pendingBackup = null;
    if (errorElement) {
      errorElement.textContent = "";
    }

    if (!file) {
      renderData();
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = Data.validateBackup(parsed);
      if (!result.valid) {
        throw new Error(result.error);
      }
      state.pendingBackup = {
        cropPlans: result.cropPlans,
        fileName: file.name,
      };
      renderData();
    } catch (error) {
      renderData();
      const currentError = document.getElementById("import-error");
      if (currentError) {
        currentError.textContent =
          error instanceof SyntaxError
            ? "JSONとして読み込めないファイルです。"
            : error.message;
      }
    }
  }

  function restoreBackup() {
    if (!state.pendingBackup) {
      return;
    }

    const count = state.pendingBackup.cropPlans.length;
    if (
      !window.confirm(
        `現在のデータを、バックアップ内の${count}件で上書き復元します。よろしいですか？`,
      )
    ) {
      return;
    }

    try {
      state.plans = Data.saveCropPlans(state.pendingBackup.cropPlans);
      state.pendingBackup = null;
      setRoute("field");
      showToast("バックアップを復元しました。");
    } catch (error) {
      showToast(`復元できませんでした。${error.message}`, "error");
    }
  }

  function deleteAllData() {
    if (
      !window.confirm(
        "すべての作付けデータを削除します。この操作は元に戻せません。",
      )
    ) {
      return;
    }

    try {
      Data.clearCropPlans();
      state.plans = [];
      state.pendingBackup = null;
      renderData();
      showToast("すべての作付けデータを削除しました。");
    } catch (error) {
      showToast(`削除できませんでした。${error.message}`, "error");
    }
  }

  function handleAppClick(event) {
    const cell = event.target.closest("[data-cell-id]");
    if (cell) {
      const cellId = Number(cell.dataset.cellId);
      if (state.selectionMode) {
        if (state.selectedCells.has(cellId)) {
          state.selectedCells.delete(cellId);
        } else {
          state.selectedCells.add(cellId);
        }
        renderField();
        return;
      }

      if (cell.dataset.planId) {
        showPlanDetail(cell.dataset.planId);
      }
      return;
    }

    const yearPlanLabel = event.target.closest("[data-year-plan-id]");
    if (yearPlanLabel) {
      showPlanDetail(yearPlanLabel.dataset.yearPlanId);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.action;
    if (action === "new-plan" || action === "new-plan-from-year") {
      beginNewPlan();
    } else if (action === "selection-clear") {
      state.selectedCells.clear();
      renderField();
    } else if (action === "selection-cancel") {
      state.selectionMode = false;
      state.selectedCells.clear();
      renderField();
    } else if (action === "selection-confirm") {
      if (state.selectedCells.size) {
        state.selectionMode = false;
        renderField();
        openPlanForm();
      }
    } else if (action === "previous-year") {
      state.annualYear -= 1;
      renderYear();
    } else if (action === "next-year") {
      state.annualYear += 1;
      renderYear();
    } else if (action === "current-year") {
      state.annualYear = Number(todayValue().slice(0, 4));
      renderYear();
    } else if (action === "export-backup") {
      exportBackup();
    } else if (action === "restore-backup") {
      restoreBackup();
    } else if (action === "delete-all") {
      deleteAllData();
    }
  }

  function handleAppChange(event) {
    if (event.target.id === "backup-file") {
      readBackupFile(event.target.files?.[0] || null);
    }
  }

  function handleDialogClick(event) {
    const formCell = event.target.closest("[data-form-cell-id]");
    if (formCell) {
      const cellId = Number(formCell.dataset.formCellId);
      if (state.formCellIds.has(cellId)) {
        state.formCellIds.delete(cellId);
      } else {
        state.formCellIds.add(cellId);
      }
      updateFormCellUi();
      return;
    }

    const actionElement = event.target.closest("[data-dialog-action]");
    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.dialogAction;
    if (action === "close") {
      closeDialog();
    } else if (action === "edit-plan") {
      const plan = state.plans.find(
        (item) => item.id === actionElement.dataset.planId,
      );
      if (plan) {
        openPlanForm(plan);
      }
    } else if (action === "delete-plan") {
      deletePlan(actionElement.dataset.planId);
    }
  }

  function initialize() {
    try {
      state.plans = Data.getCropPlans();
    } catch (error) {
      state.plans = [];
      window.setTimeout(
        () => showToast("ブラウザ内の保存データを読み込めませんでした。", "error"),
        0,
      );
    }

    navButtons.forEach((button) => {
      button.addEventListener("click", () => setRoute(button.dataset.route));
    });

    app.addEventListener("click", handleAppClick);
    app.addEventListener("change", handleAppChange);

    dialogContent.addEventListener("click", handleDialogClick);
    dialogContent.addEventListener("submit", (event) => {
      if (event.target.id === "plan-form") {
        event.preventDefault();
        savePlanFromForm(event.target);
      }
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closeDialog();
      }
    });

    render();
  }

  initialize();
})();
