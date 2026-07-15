// Minimal i18n dictionary for Quaesitor.
//
// Supports English (en) and Arabic (ar). Arabic is RTL.
// The dictionary is intentionally flat and small — only UI chrome strings
// (buttons, labels, headings). LLM-generated content (plans, reports,
// sub-questions) is NOT translated; it comes back in whatever language the
// user wrote their query in.

export type Locale = "en" | "ar";

export const LOCALES: Locale[] = ["en", "ar"];

export const RTL_LOCALES: Locale[] = ["ar"];

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

// UI string keys. Keep alphabetically sorted for easy scanning.
export type StringKey =
  | "appName"
  | "appTagline"
  | "cancel"
  | "close"
  | "done"
  | "editPlan"
  | "enterQuery"
  | "examples"
  | "export"
  | "finalReport"
  | "followUpQuestions"
  | "hello"
  | "liveActivity"
  | "loading"
  | "new"
  | "newSection"
  | "newSectionDesc"
  | "pages"
  | "pagesRead"
  | "planning"
  | "planningLong"
  | "researching"
  | "researchingLong"
  | "save"
  | "selfHosted"
  | "skipToContent"
  | "startResearch"
  | "stop"
  | "technicalDetails"
  | "toggleTheme"
  | "toggleLanguage"
  | "writing"
  | "writingLong"
  | "writingReport"
  | "modeResearch"
  | "modeQuick"
  | "modeDocuments"
  | "modeHistory"
  | "comingSoon"
  | "quickTitle"
  | "quickSubtitle"
  | "quickPlaceholder"
  | "quickThinking"
  | "quickResponse"
  | "quickSend"
  | "documentsPlaceholder"
  | "documentsDesc"
  | "historyPlaceholder"
  | "historyDesc"
  | "uploadDocument"
  | "uploadHint"
  | "dragDrop"
  | "orBrowse"
  | "selectDocument"
  | "selectDocumentHint"
  | "documentPreview"
  | "askMode"
  | "summarizeMode"
  | "questionsMode"
  | "askPlaceholder"
  | "summarizeBtn"
  | "suggestQuestionsBtn"
  | "answer"
  | "uploading"
  | "noDocuments"
  | "exportAs"
  | "exportPdf"
  | "exportDocx"
  | "exportMd"
  | "exporting"
  | "noSessions"
  | "sessionResearch"
  | "sessionDocQA"
  | "sessionQuick"
  | "loadSession"
  | "deleteSession"
  | "clearAllSessions"
  | "sessionContent"
  | "confirmDeleteAll";

type Dictionary = Record<StringKey, string>;

export const STRINGS: Record<Locale, Dictionary> = {
  en: {
    appName: "Quaesitor",
    appTagline: "Quaesitor · self-hosted AI workstation, free, multi-round",
    cancel: "Cancel",
    close: "Close",
    done: "Done",
    editPlan: "Edit plan",
    enterQuery: "Enter your research question or paste a brief...",
    examples: "Try one of these:",
    export: "Export",
    finalReport: "Final report",
    followUpQuestions: "Follow-up questions",
    hello: "Hello",
    liveActivity: "Live activity",
    loading: "Loading...",
    new: "New",
    newSection: "New section",
    newSectionDesc: "Describe what this section covers.",
    pages: "pages",
    pagesRead: "read",
    planning: "Planning",
    planningLong: "Creating research plan...",
    researching: "Researching",
    researchingLong: "Analyzing your query and designing the report structure",
    save: "Save",
    selfHosted: "self-hosted",
    skipToContent: "Skip to content",
    startResearch: "Start deep research",
    stop: "Stop",
    technicalDetails: "Technical details",
    toggleTheme: "Toggle theme",
    toggleLanguage: "Toggle language",
    writing: "Writing",
    writingLong: "Writing report...",
    writingReport: "Writing report...",
    modeResearch: "Research",
    modeQuick: "Quick",
    modeDocuments: "Documents",
    modeHistory: "History",
    comingSoon: "Coming soon",
    quickTitle: "Quick Ask",
    quickSubtitle: "Fast answers from NVIDIA — no research pipeline.",
    quickPlaceholder: "Ask anything...",
    quickThinking: "Thinking...",
    quickResponse: "Response",
    quickSend: "Send",
    documentsPlaceholder: "Document Q&A",
    documentsDesc: "Upload PDFs, DOCX, or images and ask questions about them. Coming in the next update.",
    historyPlaceholder: "History",
    historyDesc: "Your past research sessions will appear here. Coming soon.",
    uploadDocument: "Upload document",
    uploadHint: "PDF, DOCX, TXT, MD, or images. Max 50MB.",
    dragDrop: "Drag & drop a file here",
    orBrowse: "or click to browse",
    selectDocument: "Select a document",
    selectDocumentHint: "Select a document from the left to ask questions.",
    documentPreview: "Preview",
    askMode: "Ask",
    summarizeMode: "Summarize",
    questionsMode: "Questions",
    askPlaceholder: "Ask a question about this document...",
    summarizeBtn: "Summarize",
    suggestQuestionsBtn: "Suggest questions",
    answer: "Answer",
    uploading: "Uploading & extracting...",
    noDocuments: "No documents yet. Upload one to get started.",
    exportAs: "Export as",
    exportPdf: "Export as PDF",
    exportDocx: "Export as DOCX",
    exportMd: "Export as Markdown",
    exporting: "Exporting...",
    noSessions: "No sessions yet. Completed research and Q&A will appear here.",
    sessionResearch: "Research",
    sessionDocQA: "Document Q&A",
    sessionQuick: "Quick Ask",
    loadSession: "Load session",
    deleteSession: "Delete session",
    clearAllSessions: "Clear all",
    sessionContent: "Session content",
    confirmDeleteAll: "Delete all sessions? This cannot be undone.",
  },
  ar: {
    appName: "كويسيتور",
    appTagline: "كويسيتور · محطة ذكاء اصطناعي ذاتية الاستضافة، مجانية، متعددة الجولات",
    cancel: "إلغاء",
    close: "إغلاق",
    done: "تم",
    editPlan: "تعديل الخطة",
    enterQuery: "اكتب سؤال بحثك أو الصق ملخصًا...",
    examples: "جرّب أحد هذه:",
    export: "تصدير",
    finalReport: "التقرير النهائي",
    followUpQuestions: "أسئلة متابعة",
    hello: "مرحبًا",
    liveActivity: "النشاط المباشر",
    loading: "جارٍ التحميل...",
    new: "جديد",
    newSection: "قسم جديد",
    newSectionDesc: "صف ما يغطيه هذا القسم.",
    pages: "صفحات",
    pagesRead: "قُرئت",
    planning: "تخطيط",
    planningLong: "جارٍ إنشاء خطة البحث...",
    researching: "بحث",
    researchingLong: "تحليل استعلامك وتصميم هيكل التقرير",
    save: "حفظ",
    selfHosted: "ذاتي الاستضافة",
    skipToContent: "تخطّي إلى المحتوى",
    startResearch: "ابدأ البحث العميق",
    stop: "إيقاف",
    technicalDetails: "التفاصيل التقنية",
    toggleTheme: "تبديل المظهر",
    toggleLanguage: "تبديل اللغة",
    writing: "كتابة",
    writingLong: "جارٍ كتابة التقرير...",
    writingReport: "جارٍ كتابة التقرير...",
    modeResearch: "بحث",
    modeQuick: "سريع",
    modeDocuments: "مستندات",
    modeHistory: "السجل",
    comingSoon: "قريبًا",
    quickTitle: "سؤال سريع",
    quickSubtitle: "إجابات سريعة من NVIDIA — بدون خط بحث.",
    quickPlaceholder: "اسأل أي شيء...",
    quickThinking: "جارٍ التفكير...",
    quickResponse: "الرد",
    quickSend: "إرسال",
    documentsPlaceholder: "أسئلة المستندات",
    documentsDesc: "ارفع ملفات PDF أو DOCX أو صور واسأل عنها. قريبًا في التحديث القادم.",
    historyPlaceholder: "السجل",
    historyDesc: "ستظهر جلسات البحث السابقة هنا. قريبًا.",
    uploadDocument: "رفع مستند",
    uploadHint: "PDF أو DOCX أو TXT أو MD أو صور. الحد الأقصى 50 ميجابايت.",
    dragDrop: "اسحب وأفلت ملفًا هنا",
    orBrowse: "أو انقر للتصفح",
    selectDocument: "اختر مستندًا",
    selectDocumentHint: "اختر مستندًا من اليسار لطرح أسئلة.",
    documentPreview: "معاينة",
    askMode: "اسأل",
    summarizeMode: "لخّص",
    questionsMode: "أسئلة",
    askPlaceholder: "اطرح سؤالًا حول هذا المستند...",
    summarizeBtn: "لخّص",
    suggestQuestionsBtn: "اقترح أسئلة",
    answer: "الإجابة",
    uploading: "جارٍ الرفع والاستخراج...",
    noDocuments: "لا توجد مستندات بعد. ارفع واحدًا للبدء.",
    exportAs: "تصدير كـ",
    exportPdf: "تصدير كـ PDF",
    exportDocx: "تصدير كـ DOCX",
    exportMd: "تصدير كـ Markdown",
    exporting: "جارٍ التصدير...",
    noSessions: "لا توجد جلسات بعد. البحوث والأسئلة المنجزة ستظهر هنا.",
    sessionResearch: "بحث",
    sessionDocQA: "أسئلة المستندات",
    sessionQuick: "سؤال سريع",
    loadSession: "تحميل الجلسة",
    deleteSession: "حذف الجلسة",
    clearAllSessions: "مسح الكل",
    sessionContent: "محتوى الجلسة",
    confirmDeleteAll: "حذف كل الجلسات؟ لا يمكن التراجع.",
  },
};

export function t(locale: Locale, key: StringKey): string {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
}
