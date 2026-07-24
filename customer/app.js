const tabPages = new Set(["home", "category", "cart", "mine"]);
const titles = {
  home: "医妍日记",
  category: "分类",
  cart: "购物车",
  mine: "我的",
  product: "产品详情",
  brand: "医妍日记",
  agreements: "我的协议",
  "agreement-detail": "协议详情",
};

const agreements = [
  ["privacy", "医妍日记隐私协议", "说明个人信息的收集、使用与保护方式"],
  ["service", "用户服务协议", "了解账户、服务和使用规则"],
  ["care", "护理使用协议", "了解护理产品的使用提示与注意事项"],
  ["points", "积分规则", "了解积分获取、使用与有效期"],
  ["levels", "积分会员等级规则", "了解会员等级成长及更新方式"],
  ["rights", "会员权益使用协议", "了解会员权益的适用范围与规则"],
];

const state = {
  current: "home",
  history: [],
  cartCount: 0,
  activeAgreement: agreements[0],
  acknowledged: new Set(),
};

const pages = [...document.querySelectorAll("[data-page]")];
const pageTitle = document.querySelector("#pageTitle");
const backButton = document.querySelector("#backButton");
const tabbar = document.querySelector("#tabbar");
const toast = document.querySelector("#toast");
const bindModal = document.querySelector("#bindModal");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 1500);
}

function navigate(page, options = {}) {
  if (!titles[page]) return;
  if (!options.replace && state.current !== page) state.history.push(state.current);
  state.current = page;
  pages.forEach((node) => node.classList.toggle("is-active", node.dataset.page === page));
  pageTitle.textContent = titles[page];
  const isTabPage = tabPages.has(page);
  tabbar.classList.toggle("is-hidden", !isTabPage);
  backButton.classList.toggle("is-visible", !isTabPage);
  document.querySelectorAll(".tabbar [data-go]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.go === page);
  });
  document.querySelector("#pageStack").scrollTop = 0;
  window.scrollTo({ top: 0, behavior: "instant" });
  history.replaceState(null, "", `#${page}`);
}

function goBack() {
  navigate(state.history.pop() || "home", { replace: true });
}

function renderCart() {
  const empty = document.querySelector("#emptyCart");
  const items = document.querySelector("#cartItems");
  document.querySelector("#cartCount").textContent = `已选 ${state.cartCount} 件商品`;
  empty.hidden = state.cartCount > 0;
  items.hidden = state.cartCount === 0;
  if (!state.cartCount) return;
  items.innerHTML = `
    <article class="cart-item">
      <img src="./assets/category-repair-banner.jpg" alt="医妍日记蛋白修护精华">
      <div><h3>医妍日记蛋白修护精华</h3><p>精华护理系列 · 数量 ${state.cartCount}</p></div>
      <button type="button" data-remove-product>−</button>
    </article>`;
}

function renderAgreements() {
  document.querySelector("#agreementList").innerHTML = agreements.map((item, index) => `
    <button class="agreement-card" type="button" data-agreement="${item[0]}">
      <span class="agreement-card__num">${String(index + 1).padStart(2, "0")}</span>
      <span><h3>${item[1]}</h3><p>${item[2]}</p></span>
      <i>›</i>
    </button>`).join("");
}

function openAgreement(id) {
  state.activeAgreement = agreements.find((item) => item[0] === id) || agreements[0];
  const [agreementId, title, summary] = state.activeAgreement;
  const article = document.querySelector("#agreementArticle");
  article.innerHTML = `
    <small>YIYANRIJI · AGREEMENT</small>
    <h1>${title}</h1>
    <p>${summary}。请在使用相关服务前认真阅读本协议。</p>
    <h2>一、适用范围</h2>
    <p>本协议适用于医妍日记向用户提供的相关产品展示、会员服务及护理信息服务。用户使用服务即表示已阅读并理解本协议。</p>
    <h2>二、账户与信息</h2>
    <p>用户应提供真实、准确、完整的信息，并妥善保管账户。因信息变化产生的影响，用户可及时更新资料或联系服务人员处理。</p>
    <h2>三、服务说明</h2>
    <p>页面展示内容用于帮助用户了解服务与产品。具体服务安排、权益范围及使用条件，以实际页面说明和门店确认结果为准。</p>
    <h2>四、用户权利与义务</h2>
    <p>用户有权了解服务规则、查询相关记录并提出合理意见，同时应遵守法律法规及平台秩序，不得利用服务从事不当活动。</p>
    <h2>五、协议更新</h2>
    <p>为持续完善服务，本协议可能根据业务需要更新。更新后的版本将在页面展示，用户可重新阅读并确认。</p>
    <h2>六、联系我们</h2>
    <p>如对协议或服务有疑问，可通过医妍日记服务入口与我们联系。</p>
    <p style="padding:24px 0 110px;text-align:center;color:#8d9ab0">— 已阅读至协议末尾 —</p>`;
  const readState = document.querySelector("#readState");
  const ackButton = document.querySelector("#ackButton");
  const done = state.acknowledged.has(agreementId);
  readState.textContent = done ? "当前版本已完成知晓确认" : "已阅读至底部，可以完成确认";
  ackButton.textContent = done ? "当前版本已知晓" : "我已知晓";
  ackButton.disabled = done;
  ackButton.classList.toggle("is-ready", !done);
  navigate("agreement-detail");
}

document.addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]");
  if (go) return navigate(go.dataset.go);

  if (event.target.closest("[data-open-product]")) return navigate("product");

  const add = event.target.closest("[data-add-product]");
  if (add) {
    state.cartCount += 1;
    renderCart();
    return showToast("已加入购物车");
  }

  if (event.target.closest("[data-buy-now]")) {
    state.cartCount += 1;
    renderCart();
    return navigate("cart");
  }

  if (event.target.closest("[data-remove-product]")) {
    state.cartCount = Math.max(0, state.cartCount - 1);
    renderCart();
    return;
  }

  const primaryTab = event.target.closest("[data-category-tab]");
  if (primaryTab) {
    document.querySelectorAll("[data-category-tab]").forEach((button) => button.classList.toggle("is-active", button === primaryTab));
    document.querySelector("#skinCategory").hidden = primaryTab.dataset.categoryTab !== "skin";
    document.querySelector("#homeCategory").hidden = primaryTab.dataset.categoryTab !== "home";
    return;
  }

  const openView = event.target.closest("[data-open-view]");
  if (openView) {
    navigate("brand");
    const desired = openView.dataset.openView;
    document.querySelectorAll("[data-view-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.viewTab === desired));
    document.querySelector("#guideView").hidden = desired !== "guide";
    document.querySelector("#brandView").hidden = desired !== "brand";
    return;
  }

  const viewTab = event.target.closest("[data-view-tab]");
  if (viewTab) {
    document.querySelectorAll("[data-view-tab]").forEach((button) => button.classList.toggle("is-active", button === viewTab));
    document.querySelector("#guideView").hidden = viewTab.dataset.viewTab !== "guide";
    document.querySelector("#brandView").hidden = viewTab.dataset.viewTab !== "brand";
    return;
  }

  if (event.target.closest("[data-open-bind]")) bindModal.hidden = false;
  if (event.target.closest("[data-close-modal]")) bindModal.hidden = true;
  if (event.target.closest("[data-confirm-bind]")) {
    bindModal.hidden = true;
    showToast("已绑定顾问：顾问小岚");
  }

  if (event.target.closest("[data-open-agreements]")) navigate("agreements");
  const agreement = event.target.closest("[data-agreement]");
  if (agreement) openAgreement(agreement.dataset.agreement);

  const toastAction = event.target.closest("[data-toast]");
  if (toastAction) showToast(`${toastAction.dataset.toast}功能已准备`);
});

backButton.addEventListener("click", goBack);
bindModal.addEventListener("click", (event) => {
  if (event.target === bindModal) bindModal.hidden = true;
});
document.querySelector("#ackButton").addEventListener("click", () => {
  state.acknowledged.add(state.activeAgreement[0]);
  document.querySelector("#readState").textContent = "当前版本已完成知晓确认";
  document.querySelector("#ackButton").textContent = "当前版本已知晓";
  document.querySelector("#ackButton").disabled = true;
  document.querySelector("#ackButton").classList.remove("is-ready");
  showToast("已确认知晓");
});

renderAgreements();
renderCart();
navigate(location.hash.replace("#", "") || "home", { replace: true });
