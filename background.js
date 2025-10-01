const WORKER_ENDPOINT = "https://job-lens.mehdihadizadeh-k.workers.dev";

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
  static async search(query) {
    const url = `${WORKER_ENDPOINT}/?q=${encodeURIComponent(query)}`;
    console.log(`Background: Searching for -> ${query}`);

    const response = await fetch(url);
    const result = await response.json();
    console.log("Search result:", result);

    return result;
  }

  static async submitFeedback(
    searchQuery,
    companySlug,
    voteType,
    previousVote
  ) {
    const url = `${WORKER_ENDPOINT}/feedback`;
    console.log(
      `Background: Submitting ${voteType} for ${companySlug} with query "${searchQuery}" (previous: ${previousVote})`
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          searchQuery,
          companySlug,
          type: voteType,
          previousVote: previousVote || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Feedback result:", result);

      if (result.status === "error") {
        throw new Error(result.message || "Feedback submission failed");
      }

      return result;
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      throw error;
    }
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

class CompanyReviewService {
  static async findCompanyReviews(request, sender) {
    const currentHost = sender?.tab ? new URL(sender.tab.url).host : null;

    const settings = await chrome.storage.sync.get(["disabledSites"]);

    if (currentHost && settings.disabledSites?.includes(currentHost)) {
      console.log(`Background: Extension disabled on ${currentHost}`);
      return { status: "disabled" };
    }

    const normalizedWebsite = StringUtils.normalizeWebsite(request.website);
    const sanitizedName = StringUtils.sanitizeName(request.primaryName);

    try {
      let bestMatch = null;
      let combinedAll = [];
      let searchQuery = "";
      let searchInfo = {
        primaryUsed: null,
        fallback: false,
      };

      // Strategy: Search by website first, fallback to name only if no results
      if (normalizedWebsite) {
        const websiteResult = await APIClient.search(normalizedWebsite);

        if (websiteResult.allResults?.length > 0) {
          // Website search successful - use these results
          searchInfo.primaryUsed = "website";
          combinedAll = websiteResult.allResults;
          bestMatch = websiteResult.bestMatch;
          searchQuery = websiteResult.searchQuery || normalizedWebsite;
        } else {
          // Website search returned no results, fallback to name
          searchInfo.primaryUsed = "name";
          searchInfo.fallback = true;
          const nameResult = await APIClient.search(sanitizedName);

          combinedAll = nameResult.allResults || [];
          bestMatch = nameResult.bestMatch;
          searchQuery = nameResult.searchQuery || sanitizedName;
        }
      } else {
        // No website available, search by name only
        searchInfo.primaryUsed = "name";
        searchInfo.fallback = true;
        const nameResult = await APIClient.search(sanitizedName);

        combinedAll = nameResult.allResults || [];
        bestMatch = nameResult.bestMatch;
        searchQuery = nameResult.searchQuery || sanitizedName;
      }

      if (bestMatch) {
        return {
          status: "success",
          data: bestMatch,
          all: combinedAll,
          searchInfo,
          searchQuery,
        };
      } else {
        return {
          status: "not_found",
          all: combinedAll,
          searchInfo,
          searchQuery,
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
}

// Event Listeners
chrome.action.onClicked.addListener((tab) => {
  ExtensionBadgeManager.toggleSiteStatus(tab);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "findCompanyReviews") {
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

    return true;
  }

  if (request.action === "submitFeedback") {
    console.log("Background: submitFeedback request received.");

    APIClient.submitFeedback(
      request.searchQuery,
      request.companySlug,
      request.voteType,
      request.previousVote
    )
      .then((result) => {
        sendResponse({
          status: "success",
          likes: result.likes,
          dislikes: result.dislikes,
        });
      })
      .catch((error) => {
        console.error("Background: Feedback submission error:", error);
        sendResponse({
          status: "error",
          message: error.message || String(error),
        });
      });

    return true;
  }
});
