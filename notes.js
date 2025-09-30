// notes.js

class NotesManager {
  constructor() {
    this.notesList = document.getElementById("notes-list");
    this.FEEDBACK_DURATION = 2000;
  }

  async init() {
    const notes = await this.loadNotes();
    this.render(notes);
  }

  async loadNotes() {
    const items = await chrome.storage.local.get(null);
    return Object.entries(items)
      .filter(([_, value]) => value?.companyName)
      .sort((a, b) => {
        const nameA = a[1].companyName || "";
        const nameB = b[1].companyName || "";
        return nameA.localeCompare(nameB, "fa", { sensitivity: "base" });
      });
  }

  render(notes) {
    if (notes.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.notesList.innerHTML = "";
    notes.forEach(([key, noteObj]) => {
      const noteItem = new NoteItem(key, noteObj, () =>
        this.handleNoteDeleted()
      );
      noteItem.appendTo(this.notesList);
    });
  }

  renderEmptyState() {
    this.notesList.innerHTML = `
      <div class="ext-not-found-message" 
           style="color: var(--color-text-dark); 
                  background-color: var(--color-bg-light); 
                  border: 1px solid var(--color-border-light);">
        🔍 هیچ یادداشتی ثبت نشده است.
      </div>
    `;
  }

  async handleNoteDeleted() {
    const remainingNotes = await this.loadNotes();
    if (remainingNotes.length === 0) {
      this.renderEmptyState();
    }
  }
}

class NoteItem {
  constructor(storageKey, noteData, onDeleteCallback) {
    this.storageKey = storageKey;
    this.noteData = noteData;
    this.onDeleteCallback = onDeleteCallback;
    this.container = null;
    this.textarea = null;
    this.saveBtn = null;
    this.deleteBtn = null;
  }

  appendTo(parent) {
    this.container = this.createContainer();
    parent.appendChild(this.container);
    this.attachEventListeners();
  }

  createContainer() {
    const div = document.createElement("div");
    div.className = "note-item";
    div.innerHTML = `
      <h3>${this.noteData.companyName}</h3>
      <p><a href="${this.noteData.jobUrl}" target="_blank">مشاهده آگهی</a></p>
      <textarea>${this.noteData.note || ""}</textarea>
      <div class="note-actions">
        <button class="save ext-btn-primary">ذخیره</button>
        <button class="delete ext-btn-danger">حذف</button>
      </div>
    `;

    this.textarea = div.querySelector("textarea");
    this.saveBtn = div.querySelector(".save");
    this.deleteBtn = div.querySelector(".delete");

    return div;
  }

  attachEventListeners() {
    this.saveBtn.addEventListener("click", () => this.handleSave());
    this.deleteBtn.addEventListener("click", () => this.handleDelete());
  }

  async handleSave() {
    const originalText = this.saveBtn.textContent;
    this.saveBtn.textContent = "در حال ذخیره...";
    this.saveBtn.disabled = true;

    const noteContent = this.textarea.value.trim();

    try {
      if (noteContent) {
        await this.saveNote(noteContent);
        this.showSaveSuccess();
      } else {
        await this.deleteNote();
        this.showDeleteSuccess();
      }
    } catch (error) {
      console.error("Failed to save note:", error);
      this.showError();
    }

    setTimeout(() => {
      this.saveBtn.textContent = originalText;
      this.saveBtn.disabled = false;
      this.saveBtn.className = "save ext-btn-primary";
      this.saveBtn.style.backgroundColor = "";
    }, 2000);
  }

  async handleDelete() {
    const confirmed = confirm(
      `آیا مطمئنید که می‌خواهید یادداشت "${this.noteData.companyName}" را حذف کنید؟`
    );

    if (!confirmed) return;

    try {
      await chrome.storage.local.remove(this.storageKey);
      this.container.remove();
      this.onDeleteCallback();
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  }

  async saveNote(content) {
    await chrome.storage.local.set({
      [this.storageKey]: {
        ...this.noteData,
        note: content,
      },
    });
  }

  async deleteNote() {
    await chrome.storage.local.remove(this.storageKey);

    setTimeout(() => {
      this.container.remove();
      this.onDeleteCallback();
    }, 1000);
  }

  showSaveSuccess() {
    this.saveBtn.textContent = "ذخیره شد ✓";
    this.saveBtn.className = "save";
  }

  showDeleteSuccess() {
    this.saveBtn.textContent = "حذف شد 🗑️";
    this.saveBtn.className = "save";
    this.saveBtn.style.backgroundColor = "var(--color-error)";
  }

  showError() {
    this.saveBtn.textContent = "خطا ❌";
    this.saveBtn.className = "save";
    this.saveBtn.style.backgroundColor = "var(--color-error)";
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  const notesManager = new NotesManager();
  notesManager.init();
});
