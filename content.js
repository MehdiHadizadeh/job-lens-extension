class JobReviewsExtension {
  constructor() {
    this.host = window.location.host;
    this.handlers = {
      "jobinja.ir": () => this.handleJobinja(),
      "jobvision.ir": () => this.handleJobvision(),
    };
  }

  async init() {
    const {
      isExtensionEnabled = true,
      isJobinjaEnabled = true,
      isJobvisionEnabled = true,
    } = await chrome.storage.sync.get([
      "isExtensionEnabled",
      "isJobinjaEnabled",
      "isJobvisionEnabled",
    ]);

    if (!isExtensionEnabled) {
      console.log("Job Lens Extension is globally disabled.");
      return;
    }

    // Mapping host to site toggle status
    const siteStatusMap = {
      "jobinja.ir": isJobinjaEnabled,
      "jobvision.ir": isJobvisionEnabled,
    };

    window.addEventListener("load", () => {
      console.log("Job Lens Extension active on:", this.host);

      const handlerEntry = Object.entries(this.handlers).find(([domain]) =>
        this.host.includes(domain)
      );

      if (handlerEntry) {
        const [domain, handler] = handlerEntry;

        if (siteStatusMap[domain]) {
          console.log(`Handler for ${domain} is enabled. Executing...`);
          handler();
        } else {
          console.log(`Handler for ${domain} is disabled via settings.`);
        }
      } else {
        console.log("No specific handler for this site.");
      }
    });
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
    this.searchQuery = response.searchQuery || ""; // Store the normalized search query
    this.floatingBtn = null;
    this.panel = null;
    this.userVotes = {}; // Will store user's votes from storage
  }

  async render() {
    await this.loadUserVotes();
    this.createButton();
    this.createPanel();
    this.attachEventListeners();
  }

  async loadUserVotes() {
    try {
      const result = await chrome.storage.local.get(["companyVotes"]);
      this.userVotes = result.companyVotes || {};
    } catch (error) {
      console.error("Failed to load user votes:", error);
      this.userVotes = {};
    }
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
      fallback: "آدرس و نام شرکت",
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
    card.dataset.slug = company.slug;

    const rating = company.rating || 0;
    const { color, bgColor } = this.getRatingColors(rating);

    // Create header
    const header = document.createElement("div");
    header.className = "ext-review-header";

    const companyName = document.createElement("strong");
    companyName.className = "ext-company-name";
    companyName.textContent = company.name || "—";

    const ratingBadge = document.createElement("span");
    if (rating) {
      ratingBadge.className = "ext-rating-badge";
      ratingBadge.style.color = color;
      ratingBadge.style.backgroundColor = bgColor;
      ratingBadge.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>
      </svg>
      ${rating ? Number(rating).toFixed(2) : "—"}
    `;
    }

    header.appendChild(companyName);
    if (rating) {
      header.appendChild(ratingBadge);
    }

    // Create feedback section
    const feedbackSection = this.createFeedbackSection(company);

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

    const mainActionRow = document.createElement("div");
    mainActionRow.className = "ext-feedback-buttons-wrapper";

    mainActionRow.appendChild(link);
    mainActionRow.appendChild(feedbackSection);

    card.appendChild(header);
    card.appendChild(mainActionRow);

    return card;
  }

  createFeedbackSection(company) {
    const section = document.createElement("div");
    section.className = "ext-feedback-section";

    // Create a unique vote key based on search query + company slug
    const voteKey = `${this.searchQuery}:${company.slug}`;
    const userVote = this.userVotes[voteKey];
    const likes = company.likes || 0;
    const dislikes = company.dislikes || 0;

    // Like button
    const likeBtn = document.createElement("button");
    likeBtn.className = "ext-feedback-btn ext-feedback-like";
    likeBtn.dataset.slug = company.slug;
    likeBtn.dataset.type = "like";
    likeBtn.dataset.voteKey = voteKey;
    if (userVote === "like") {
      likeBtn.classList.add("active");
    }
    likeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 10v12"></path>
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path>
      </svg>
      <span class="ext-feedback-count">${likes}</span>
    `;

    // Dislike button
    const dislikeBtn = document.createElement("button");
    dislikeBtn.className = "ext-feedback-btn ext-feedback-dislike";
    dislikeBtn.dataset.slug = company.slug;
    dislikeBtn.dataset.type = "dislike";
    dislikeBtn.dataset.voteKey = voteKey;
    if (userVote === "dislike") {
      dislikeBtn.classList.add("active");
    }
    dislikeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 14V2"></path>
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"></path>
      </svg>
      <span class="ext-feedback-count">${dislikes}</span>
    `;

    section.appendChild(likeBtn);
    section.appendChild(dislikeBtn);

    // Attach event listeners
    likeBtn.addEventListener("click", () =>
      this.handleFeedback(company.slug, "like", likeBtn)
    );
    dislikeBtn.addEventListener("click", () =>
      this.handleFeedback(company.slug, "dislike", dislikeBtn)
    );

    return section;
  }

  async handleFeedback(companySlug, voteType, button) {
    const card = button.closest(".ext-review-card");
    const allButtons = card.querySelectorAll(".ext-feedback-btn");

    // Get vote key from button (query:slug)
    const voteKey = button.dataset.voteKey;

    // Get current user vote for this specific query+slug combination
    const currentVote = this.userVotes[voteKey];

    // Determine the new vote state
    let newVote = null;
    if (currentVote === voteType) {
      // User is un-voting (clicking same button again)
      newVote = null;
    } else {
      // User is voting (first time or changing vote)
      newVote = voteType;
    }

    // Disable all buttons during request
    allButtons.forEach((btn) => (btn.disabled = true));

    try {
      // Send feedback to background with search query and previous vote info
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "submitFeedback",
            searchQuery: this.searchQuery,
            companySlug,
            voteType,
            previousVote: currentVote || null,
          },
          resolve
        );
      });

      if (response.status === "success") {
        // Update user's vote in storage using the query:slug key
        if (newVote === null) {
          // Remove vote from storage
          delete this.userVotes[voteKey];
        } else {
          // Store new vote with query:slug key
          this.userVotes[voteKey] = newVote;
        }
        await chrome.storage.local.set({ companyVotes: this.userVotes });

        // Update UI - remove active from all buttons in this card
        allButtons.forEach((btn) => btn.classList.remove("active"));

        // Add active to current button only if it's a new vote (not un-vote)
        if (newVote !== null) {
          button.classList.add("active");
        }

        // Update counts from response
        const likeBtn = card.querySelector('[data-type="like"]');
        const dislikeBtn = card.querySelector('[data-type="dislike"]');

        if (likeBtn && response.likes !== undefined) {
          likeBtn.querySelector(".ext-feedback-count").textContent =
            response.likes;
        }
        if (dislikeBtn && response.dislikes !== undefined) {
          dislikeBtn.querySelector(".ext-feedback-count").textContent =
            response.dislikes;
        }
      } else {
        console.error("Feedback submission failed:", response.message);
        alert("خطا در ثبت نظر. لطفاً دوباره تلاش کنید.");
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert("خطا در ثبت نظر. لطفاً دوباره تلاش کنید.");
    } finally {
      // Re-enable buttons
      allButtons.forEach((btn) => (btn.disabled = false));
    }
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

    document.addEventListener("click", (e) => {
      if (
        this.panel.classList.contains("is-visible") &&
        !this.panel.contains(e.target) &&
        e.target !== this.floatingBtn
      ) {
        this.panel.classList.remove("is-visible");
      }
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
      await this.saveNote(noteContent);
      this.showFeedback("ذخیره شد ✓", "ext-btn-primary");
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
