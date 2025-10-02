# Job Lens | جاب لنز

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://www.google.com/chrome/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

Chrome extension for viewing company reviews on Iranian job sites (Jobinja.ir and Jobvision.ir).

## Features

- View company reviews from Tajrobe.wiki
- Community feedback system with like/dislike voting
- Save personal notes for job listings
- Smart search (website URL first, fallback to company name)
- Query-specific feedback (votes reflect result relevance for each search)
- Privacy-focused: all personal data stored locally

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension folder

## How It Works

1. Extension activates on Jobinja.ir and Jobvision.ir company/job pages
2. Extracts company name and website from the page
3. Searches for reviews (website URL first, then company name if needed)
4. Displays floating panel with ratings and community feedback
5. Users can vote on result relevance and save private notes

## About the Backend Worker

This extension uses a Cloudflare Worker backend (hosted by us) for:
- Fetching company reviews from Tajrobe.wiki API
- Aggregating community feedback votes
- Query-based vote storage

**Note:** The worker code is not included in this repository to maintain data consistency and unified community feedback across all users.

If you're working on features that require worker changes, please open an issue first to discuss the approach.

## Privacy

- Notes and settings stored only in your browser
- No user tracking or analytics
- No personal data collection
- Minimal permissions (only Jobinja.ir and Jobvision.ir)
- Open source and auditable

See [privacy.html](privacy.html) for complete privacy policy.

## Development

Built with vanilla JavaScript, Chrome Extension Manifest V3.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Acknowledgments

- [Tajrobe.wiki](https://tajrobe.wiki) for providing company review data
- [Jobinja.ir](https://jobinja.ir) and [Jobvision.ir](https://jobvision.ir) for job listing platforms
- All contributors and users of Job Lens


---

<div align="center">

**Made with ❤️ for Iranian job seekers | ساخته شده با ❤️ برای کارجویان ایرانی**

</div>
