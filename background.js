const WORKER_ENDPOINT = "https://job-lens.mehdihadizadeh-k.workers.dev";
const DEFAULT_PRIORITY = "website_first";

class StringUtils {
  static normalizeWebsite(raw) {
    if (!raw) return null;

    return String(raw)
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/i, "");
  }

  static sanitizeName(name) {
    if (!name) return "";

    return name
      .replace(/\(.*\)/g, "")
      .split("|")[0]
      .trim();
  }

  static normalize(text) {
    return String(text || "")
      .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, "")
      .replace(/\s/g, "")
      .toLowerCase();
  }
}

class ResultsManager {
  static mergeUniqueBySlug(firstArr = [], secondArr = []) {
    const map = new Map();

    firstArr.forEach((item) => {
      if (item?.slug) map.set(item.slug, item);
    });

    secondArr.forEach((item) => {
      if (item?.slug && !map.has(item.slug)) {
        map.set(item.slug, item);
      }
    });

    return Array.from(map.values());
  }

  static findBestMatch(searchName, results) {
    if (!results?.length) return null;

    const normalizedSearch = StringUtils.normalize(searchName);

    for (const result of results) {
      const normalizedResult = StringUtils.normalize(result.name);
      if (!normalizedResult) continue;

      if (
        normalizedResult.includes(normalizedSearch) ||
        normalizedSearch.includes(normalizedResult)
      ) {
        return result;
      }
    }

    return results[0];
  }
}

class APIClient {
  static async searchByWebsite(website) {
    const url = `${WORKER_ENDPOINT}/?q=${encodeURIComponent(website)}`;
    console.log(`Background: searchByWebsite -> ${url}`);

    const response = await fetch(url);
    const result = await response.json();
    console.log("Website search result:", result);

    return result;
  }

  static async searchByName(name) {
    const url = `${WORKER_ENDPOINT}/?q=${encodeURIComponent(name)}`;
    console.log(`Background: searchByName -> ${url}`);

    const response = await fetch(url);
    const result = await response.json();
    console.log("Name search result:", result);

    return result;
  }
}

class ExtensionBadgeManager {
  static async toggleSiteStatus(tab) {
    if (!tab?.url) return;

    const host = new URL(tab.url).host;
    const { disabledSites = [] } = await chrome.storage.sync.get([
      "disabledSites",
    ]);

    const isDisabled = disabledSites.includes(host);
    const updated = isDisabled
      ? disabledSites.filter((h) => h !== host)
      : [...disabledSites, host];

    await chrome.storage.sync.set({ disabledSites: updated });

    console.log(`Background: ${host} ${isDisabled ? "enabled" : "disabled"}`);

    await this.showBadge(tab.id, isDisabled ? "" : "OFF");
    setTimeout(() => this.clearBadge(tab.id), 2000);
  }

  static async showBadge(tabId, text) {
    await chrome.action.setBadgeText({ text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color: "#FF6B6B", tabId });
  }

  static async clearBadge(tabId) {
    await chrome.action.setBadgeText({ text: "", tabId });
  }
}

class SearchStrategy {
  constructor(priority, normalizedWebsite, sanitizedName) {
    this.priority = priority;
    this.website = normalizedWebsite;
    this.name = sanitizedName;
    this.effectiveMode = this.determineEffectiveMode();
  }

  determineEffectiveMode() {
    if (!this.website) {
      if (
        this.priority === "website_only" ||
        this.priority === "website_first"
      ) {
        return { mode: "name_only", fallback: true };
      }
    }
    return { mode: this.priority, fallback: false };
  }

  async execute() {
    const searchInfo = {
      configuredPriority: this.priority,
      effectiveMode: this.effectiveMode.mode,
      primaryUsed: null,
      fallback: this.effectiveMode.fallback,
    };

    const strategies = {
      website_only: () => this.executeWebsiteOnly(searchInfo),
      name_only: () => this.executeNameOnly(searchInfo),
      website_first: () => this.executeWebsiteFirst(searchInfo),
      name_first: () => this.executeNameFirst(searchInfo),
    };

    const strategy =
      strategies[this.effectiveMode.mode] || strategies.website_first;

    return await strategy();
  }

  async executeWebsiteOnly(searchInfo) {
    const result = await APIClient.searchByWebsite(this.website);
    searchInfo.primaryUsed = "website";

    return {
      bestMatch: result.bestMatch,
      combinedAll: result.allResults || [],
      searchInfo,
    };
  }

  async executeNameOnly(searchInfo) {
    const result = await APIClient.searchByName(this.name);
    searchInfo.primaryUsed = "name";

    return {
      bestMatch: result.bestMatch,
      combinedAll: result.allResults || [],
      searchInfo,
    };
  }

  async executeWebsiteFirst(searchInfo) {
    const websiteResult = await APIClient.searchByWebsite(this.website);

    if (websiteResult.allResults?.length > 0) {
      searchInfo.primaryUsed = "website";
      const nameResult = await APIClient.searchByName(this.name);

      const combinedAll = ResultsManager.mergeUniqueBySlug(
        websiteResult.allResults,
        nameResult.allResults || []
      );

      return {
        bestMatch:
          websiteResult.bestMatch ||
          ResultsManager.findBestMatch(this.name, combinedAll),
        combinedAll,
        searchInfo,
      };
    } else {
      searchInfo.primaryUsed = "name";
      searchInfo.fallback = true;
      const nameResult = await APIClient.searchByName(this.name);

      return {
        bestMatch: nameResult.bestMatch,
        combinedAll: nameResult.allResults || [],
        searchInfo,
      };
    }
  }

  async executeNameFirst(searchInfo) {
    const nameResult = await APIClient.searchByName(this.name);

    if (nameResult.allResults?.length > 0) {
      searchInfo.primaryUsed = "name";

      let combinedAll = nameResult.allResults;
      if (this.website) {
        const websiteResult = await APIClient.searchByWebsite(this.website);
        combinedAll = ResultsManager.mergeUniqueBySlug(
          nameResult.allResults,
          websiteResult.allResults || []
        );
      }

      return {
        bestMatch: nameResult.bestMatch || combinedAll[0] || null,
        combinedAll,
        searchInfo,
      };
    } else if (this.website) {
      searchInfo.primaryUsed = "website";
      searchInfo.fallback = true;
      const websiteResult = await APIClient.searchByWebsite(this.website);

      return {
        bestMatch: websiteResult.bestMatch,
        combinedAll: websiteResult.allResults || [],
        searchInfo,
      };
    }

    return {
      bestMatch: null,
      combinedAll: [],
      searchInfo,
    };
  }
}

class CompanyReviewService {
  static async findCompanyReviews(request, sender) {
    const currentHost = sender?.tab ? new URL(sender.tab.url).host : null;

    const settings = await chrome.storage.sync.get([
      "disabledSites",
      "searchPriority",
      "searchMode",
    ]);

    if (currentHost && settings.disabledSites?.includes(currentHost)) {
      console.log(`Background: Extension disabled on ${currentHost}`);
      return { status: "disabled" };
    }

    const priority = this.determinePriority(settings);
    const normalizedWebsite = StringUtils.normalizeWebsite(request.website);
    const sanitizedName = StringUtils.sanitizeName(request.primaryName);

    try {
      const strategy = new SearchStrategy(
        priority,
        normalizedWebsite,
        sanitizedName
      );
      const { bestMatch, combinedAll, searchInfo } = await strategy.execute();

      if (bestMatch) {
        return {
          status: "success",
          data: bestMatch,
          all: combinedAll,
          searchInfo,
        };
      } else {
        return {
          status: "not_found",
          all: combinedAll,
          searchInfo,
        };
      }
    } catch (error) {
      console.error("Background: error in findCompanyReviews:", error);
      return {
        status: "error",
        message: error.message || String(error),
      };
    }
  }

  static determinePriority(settings) {
    if (settings.searchPriority) {
      return settings.searchPriority;
    }

    if (settings.searchMode === "website") {
      return "website_only";
    } else if (settings.searchMode === "name") {
      return "name_only";
    }

    return DEFAULT_PRIORITY;
  }
}

// Event Listeners
chrome.action.onClicked.addListener((tab) => {
  ExtensionBadgeManager.toggleSiteStatus(tab);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "findCompanyReviews") return;

  console.log("Background: findCompanyReviews request received.");

  CompanyReviewService.findCompanyReviews(request, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error("Background: Unhandled error:", error);
      sendResponse({
        status: "error",
        message: error.message || String(error),
      });
    });

  return true; // Keep message channel open for async response
});
