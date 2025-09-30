
class JobReviewsExtension {
  constructor() {
    this.host = window.location.host;
    this.handlers = {
      "jobinja.ir": () => this.handleJobinja(),
      "jobvision.ir": () => this.handleJobvision(),
    };
  }

  async init() {
    const { isExtensionEnabled = true } = await chrome.storage.sync.get([
      "isExtensionEnabled",
    ]);

    if (!isExtensionEnabled) {
      console.log("Job Reviews Extension is globally disabled.");
      return;
    }

    window.addEventListener("load", () => {
      console.log("Job Reviews Extension active on:", this.host);
      this.routeHandler();
    });
  }

  routeHandler() {
    const handler = Object.entries(this.handlers).find(([domain]) =>
      this.host.includes(domain)
    );

    if (handler) {
      handler[1]();
    }
  }

  handleJobinja() {
    const companyNameElement = document.querySelector(".c-companyHeader__name");
    const websiteLinkElement = document.querySelector(
      '.c-companyHeader__metaLink[rel="nofollow noopener noreferrer"]'
    );

    if (!companyNameElement) {
      console.log("Jobinja: Company header not found.");
      return;
    }

    const fullCompanyName = companyNameElement.textContent.trim();
    const primaryName = fullCompanyName.split("|")[0].trim();
    const companyWebsite =
      websiteLinkElement?.href || websiteLinkElement?.textContent || "";

    this.sendForReview(primaryName, companyWebsite);
  }

  handleJobvision() {
    const url = window.location.href;

    if (url.includes("/companies/")) {
      this.handleJobvisionCompany();
    } else if (url.includes("/jobs/")) {
      this.handleJobvisionJob();
    } else {
      console.log("Jobvision: Unknown page type.");
    }
  }

  handleJobvisionCompany() {
    const nameEl = document.querySelector("label.font-size-2");
    const siteEl = document.querySelector("a[target=_blank][rel=nofollow]");

    const primaryName = nameEl?.textContent.trim() || "";
    const companyWebsite = siteEl?.href || "";

    this.sendForReview(primaryName, companyWebsite);
  }

  async handleJobvisionJob() {
    const titleEl = document.querySelector("h1.yn_title");
    const companyAnchor = document.querySelector("a.yn_brand");

    if (!companyAnchor || !titleEl) {
      console.log("Jobvision: company or title not found.");
      return;
    }

    const primaryName = companyAnchor.textContent.trim();
    const profileUrl = companyAnchor.href.startsWith("http")
      ? companyAnchor.href
      : `https://jobvision.ir${companyAnchor.getAttribute("href")}`;

    try {
      const companyWebsite = await this.fetchCompanyWebsite(profileUrl);
      this.sendForReview(primaryName, companyWebsite);
    } catch (error) {
      console.error("Jobvision: error fetching profile:", error);
      this.sendForReview(primaryName, "");
    }
  }

  async fetchCompanyWebsite(profileUrl) {
    const response = await fetch(profileUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const siteAnchor = doc.querySelector("a[target=_blank][rel=nofollow]");

    return siteAnchor?.href || "";
  }

  sendForReview(primaryName, companyWebsite) {
    chrome.runtime.sendMessage(
      {
        action: "findCompanyReviews",
        website: companyWebsite,
        primaryName,
      },
      (response) => {
        if (!response) {
          console.log("No response from background");
          return;
        }

        if (response.status === "disabled") {
          console.log("Extension disabled for this site.");
          return;
        }

        this.renderUI(response, primaryName);
      }
    );
  }

  renderUI(response, fallbackName) {
    const ui = new FloatingPanelUI(response, fallbackName);
    ui.render();
  }
}

class FloatingPanelUI {
  constructor(response, fallbackName) {
    this.response = response;
    this.fallbackName = fallbackName;
    this.floatingBtn = null;
    this.panel = null;
  }

  render() {
    this.createButton();
    this.createPanel();
    this.attachEventListeners();
  }

  createButton() {
    this.floatingBtn = document.createElement("button");
    this.floatingBtn.textContent = "جاب لنز";
    this.floatingBtn.className = "ext-floating-btn";
    this.floatingBtn.setAttribute("aria-label", "باز کردن پنل بررسی شرکت");
    document.body.appendChild(this.floatingBtn);
  }

  createPanel() {
    this.panel = document.createElement("div");
    this.panel.className = "ext-floating-panel";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-label", "پنل بررسی شرکت");
    document.body.appendChild(this.panel);

    this.renderSearchInfo();
    this.renderResults();
    this.renderNotesSection();
  }

  renderSearchInfo() {
    const { searchInfo } = this.response;
    if (!searchInfo) return;

    const methodMap = {
      website: "آدرس وب سایت شرکت",
      name: "نام کامل شرکت",
    };

    const method = methodMap[searchInfo.primaryUsed];
    if (method) {
      const infoDiv = document.createElement("div");
      infoDiv.className = "ext-search-method-info";
      infoDiv.innerHTML = `جستجو بر اساس <b>${method}</b> انجام شد.`;
      this.panel.appendChild(infoDiv);
    }
  }

  renderResults() {
    const results = this.getUniqueResults();

    if (results.length === 0) {
      const notFoundDiv = document.createElement("div");
      notFoundDiv.className = "ext-not-found-message";
      notFoundDiv.textContent = "نتیجه‌ای پیدا نشد.";
      this.panel.appendChild(notFoundDiv);
      return;
    }

    results.forEach((company) => {
      const card = this.createCompanyCard(company);
      this.panel.appendChild(card);
    });
  }

  getUniqueResults() {
    const seen = new Set();
    const results = [];

    if (this.response.data?.slug) {
      results.push(this.response.data);
      seen.add(this.response.data.slug);
    }

    (this.response.all || []).forEach((item) => {
      if (item?.slug && !seen.has(item.slug)) {
        results.push(item);
        seen.add(item.slug);
      }
    });

    return results;
  }

  createCompanyCard(company) {
    const card = document.createElement("div");
    card.className = "ext-review-card";

    const rating = company.rating || 0;
    const { color, bgColor } = this.getRatingColors(rating);

    // Create header
    const header = document.createElement("div");
    header.className = "ext-review-header";

    const companyName = document.createElement("strong");
    companyName.className = "ext-company-name";
    companyName.textContent = company.name || "—";

    const ratingBadge = document.createElement("span");
    ratingBadge.className = "ext-rating-badge";
    ratingBadge.style.color = color;
    ratingBadge.style.backgroundColor = bgColor;
    ratingBadge.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>
      </svg>
      ${rating ? Number(rating).toFixed(2) : "—"}
    `;

    header.appendChild(companyName);
    header.appendChild(ratingBadge);

    // Create link
    const link = document.createElement("a");
    link.href = `https://tajrobe.wiki/company/${company.slug}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "ext-action-button";
    link.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      </svg>
      مشاهده در ویکی‌تجربه
    `;

    card.appendChild(header);
    card.appendChild(link);

    return card;
  }

  getRatingColors(rating) {
    if (rating >= 4) {
      return { color: "#16a34a", bgColor: "#f0fdf4" };
    } else if (rating >= 3) {
      return { color: "#ca8a04", bgColor: "#fefce8" };
    } else {
      return { color: "#dc2626", bgColor: "#fef2f2" };
    }
  }

  renderNotesSection() {
    const companyName = this.response.data?.name || this.fallbackName;
    const notesSection = new NotesSection(companyName, window.location.href);
    notesSection.appendTo(this.panel);
  }

  attachEventListeners() {
    this.floatingBtn.addEventListener("click", () => {
      this.panel.classList.toggle("is-visible");
    });
  }
}

class NotesSection {
  constructor(companyName, jobUrl) {
    this.companyName = companyName;
    this.jobUrl = jobUrl;
    this.storageKey = jobUrl;
    this.container = null;
    this.textarea = null;
    this.saveBtn = null;
  }

  async appendTo(parentElement) {
    this.createContainer();
    parentElement.appendChild(this.container);
    await this.loadNote();
    this.attachEventListeners();
  }

  createContainer() {
    this.container = document.createElement("div");
    this.container.className = "ext-notes-section";

    const title = document.createElement("strong");
    title.textContent = "یادداشت:";

    this.textarea = document.createElement("textarea");
    this.textarea.className = "ext-notes-textarea";
    this.textarea.placeholder = "یادداشت خود را اینجا بنویسید...";
    this.textarea.setAttribute("aria-label", "یادداشت شغل");

    const controls = document.createElement("div");
    controls.className = "ext-notes-controls";

    this.saveBtn = document.createElement("button");
    this.saveBtn.className = "ext-btn-primary";
    this.saveBtn.textContent = "ذخیره یادداشت";
    this.saveBtn.setAttribute("aria-label", "ذخیره یادداشت");

    controls.appendChild(this.saveBtn);

    this.container.appendChild(title);
    this.container.appendChild(this.textarea);
    this.container.appendChild(controls);
  }

  async loadNote() {
    try {
      const data = await chrome.storage.local.get([this.storageKey]);
      if (data[this.storageKey]?.note) {
        this.textarea.value = data[this.storageKey].note;
      }
    } catch (error) {
      console.error("Failed to load note:", error);
    }
  }

  attachEventListeners() {
    this.saveBtn.addEventListener("click", () => this.handleSave());
  }

  async handleSave() {
    const originalText = this.saveBtn.textContent;
    this.saveBtn.textContent = "در حال ذخیره...";
    this.saveBtn.disabled = true;

    const noteContent = this.textarea.value.trim();

    try {
      if (noteContent) {
        await this.saveNote(noteContent);
        this.showFeedback("ذخیره شد ✓", "ext-btn-primary");
      } else {
        await this.deleteNote();
        this.showFeedback("حذف شد 🗑️", "ext-btn-danger");
      }
    } catch (error) {
      console.error("Failed to save note:", error);
      this.showFeedback("خطا در ذخیره", "ext-btn-danger");
    }

    setTimeout(() => {
      this.saveBtn.textContent = originalText;
      this.saveBtn.disabled = false;
      this.saveBtn.className = "ext-btn-primary";
    }, 2000);
  }

  async saveNote(content) {
    await chrome.storage.local.set({
      [this.storageKey]: {
        companyName: this.companyName,
        jobUrl: this.jobUrl,
        note: content,
      },
    });
  }

  async deleteNote() {
    await chrome.storage.local.remove(this.storageKey);
  }

  showFeedback(text, className) {
    this.saveBtn.textContent = text;
    this.saveBtn.className = className;
  }
}

// Initialize extension
(async () => {
  const extension = new JobReviewsExtension();
  await extension.init();
})();
