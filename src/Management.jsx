// ═══════════════════════════════════════════════════════
// MANAGEMENT.JSX — التعديلات المطلوبة
// ═══════════════════════════════════════════════════════

// ── 1. أضف import في أعلى الملف بعد السطر الأول ──
import { genId, deepClone } from "./utils.js";


// ── 2. عدّل تعريف NewSurveyPage ──
// القديم:
function NewSurveyPage({ onSaved, onCancel, user, isAdmin, existingSurvey }) {
  const [surveyType, setSurveyType] = useState(existingSurvey?.survey_type || "school");
  const [qs, setQs] = useState(
    existingSurvey?.questions?.length
      ? existingSurvey.questions.map(q => ({ ...q, options: q.options || [], allowedFileTypes: q.allowed_file_types || "pdf,xlsx" }))
      : [{ id:"q1", type:"text", label:"", required:true, options:[], allowedFileTypes:"pdf,xlsx" }]
  );

// الجديد:
function NewSurveyPage({ onSaved, onCancel, user, isAdmin, existingSurvey, initialQuestions, initialSurveyType }) {
  const [surveyType, setSurveyType] = useState(existingSurvey?.survey_type || initialSurveyType || "school");
  const [qs, setQs] = useState(() => {
    if (existingSurvey?.questions?.length) {
      return existingSurvey.questions.map(q => ({
        ...deepClone(q),
        options: q.options || [],
        allowedFileTypes: q.allowed_file_types || "pdf,xlsx",
      }));
    }
    if (initialQuestions?.length) {
      return initialQuestions.map(q => ({
        ...deepClone(q),
        id: genId(),
        options: q.options || [],
        allowedFileTypes: q.allowed_file_types || "pdf,xlsx",
      }));
    }
    return [{ id: genId(), type:"text", label:"", required:true, options:[], allowedFileTypes:"pdf,xlsx" }];
  });


// ── 3. عدّل تعريف SurveysList — أضف onSaveAsTemplate ──
// القديم:
function SurveysList({ surveys, schoolCount, onNew, onShare, onTrack, loading, isAdmin, onDelete, onApprove, onEdit }) {

// الجديد:
function SurveysList({ surveys, schoolCount, onNew, onShare, onTrack, loading, isAdmin, onDelete, onApprove, onEdit, onSaveAsTemplate }) {


// ── 4. أضف زر "حفظ كقالب" في SurveysList — بعد زر التعديل ──
// القديم:
              {isAdmin && <Btn sm variant="secondary" onClick={()=>onEdit(s)}>✏️ تعديل</Btn>}
              {isAdmin && <Btn sm variant="danger" onClick={()=>onDelete(s)}>🗑️ حذف</Btn>}

// الجديد:
              {isAdmin && <Btn sm variant="secondary" onClick={()=>onEdit(s)}>✏️ تعديل</Btn>}
              {isAdmin && <Btn sm variant="secondary" onClick={()=>onSaveAsTemplate(s)}>📋 حفظ كقالب</Btn>}
              {isAdmin && <Btn sm variant="danger" onClick={()=>onDelete(s)}>🗑️ حذف</Btn>}


