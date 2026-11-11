// The pages are written in English (what crawlers and the Snapmaker forum read). French is applied on top of them.
// A key missing here simply keeps its English text.
const FR = {
  skip: "Aller au contenu", menu: "Menu", theme: "Thème", dl: "Télécharger", "dl.win": "Télécharger pour Windows",
  "nav.story": "L'idée", "nav.features": "Fonctions", "nav.decoder": "Décodeur", "nav.history": "Historique", "nav.help": "Aider",
  "hero.eyebrow": "Dossier U1, lecture seule",
  "hero.h1": "Ce qui s'est passé sur ta U1, <em>et quand.</em>",
  "hero.lead": "Un outil local qui lit les journaux de ton imprimante et te donne une preuve que tu peux lire, garder et montrer.",
  "hero.how": "Voir comment ça marche",
  "g.local": "Local", "g.ro": "Lecture seule", "g.cloud": "Aucun cloud", "g.tel": "Aucune télémétrie", "g.ai": "Aucune IA dans l'outil",
  "story.h2": "Quand une impression s'arrête, trois questions comptent.",
  "story.lead": "Les journaux exportés de la U1 sont chiffrés : seul le support Snapmaker peut les ouvrir. U1 Doctor donne au propriétaire une preuve lisible. Il ne pilote jamais l'imprimante.",
  "s1.h": "Que signifie ce code d'erreur ?", "s1.p": "Un décodeur hors ligne avec le lien de la page officielle. Un code inconnu reste inconnu : il ne devine jamais.",
  "s2.h": "Que s'est-il passé, et quand ?", "s2.p": "Une frise bâtie uniquement sur des faits observés. Les trous restent des trous et chaque ligne garde sa source.",
  "s3.h": "Que puis-je montrer à quelqu'un ?", "s3.p": "Un paquet de preuves portable, U1-DEB, que chacun peut ouvrir et rejouer sur sa propre machine.",
  "feat.h2": "Ce que l'outil fait aujourd'hui",
  "f1.h": "Codes d'erreur officiels, décodés hors ligne", "f1.p": "Avec les notes de firmware, les têtes à inspecter et ce que le support te demandera.",
  "f2.h": "Une frise des faits observés", "f2.p": "Phases, trous explicites et fiabilité de chaque horodatage.",
  "f3.h": "Des résultats qui s'expliquent", "f3.p": "Preuves pour, preuves contre, ce qui manque et les limites. Pas de score.",
  "f4.h": "Même entrée, même hash", "f4.p": "Le rejeu donne le même résultat sous Windows, Linux et macOS, vérifié en CI.",
  "f5.h": "Un dossier de support lisible", "f5.p": "Un zip AES-256 pour le support Snapmaker, après un contrôle de confidentialité de son contenu.",
  "dec.h2": "Tape un code. Le décodeur répond.",
  "dec.lead": "Il tourne dans ton navigateur, sur le catalogue officiel. Rien de ce que tu tapes ne quitte cette page.",
  "dec.label": "Code d'erreur", "dec.idle": "Entre un code comme 0001-0523-0000-0037, ou essaie l'un de ceux-ci.",
  "dec.none": "Ce code n'est pas dans le catalogue. U1 Doctor ne devine pas : résultat INCONCLUSIVE.",
  "dec.head": "Tête", "dec.src": "Page officielle du wiki", "dec.en": "Textes du catalogue en anglais.",
  "film.h2": "Le film",
  "hist.h2": "Historique", "hist.all": "Tout l'historique", "hist.h1": "Historique", "hist.gh": "Notes de version sur GitHub",
  "hist.lead": "Chaque version, la plus récente d'abord. Le détail technique complet est dans les notes de version sur GitHub.",
  "help.h2": "Il nous manque une vraie panne.",
  "help.lead": "Jusqu'ici, seules des impressions normales ont été capturées : tout incident de l'app est synthétique. Si ta U1 s'arrête, ton rapport fait avancer tout le projet.",
  "help.cta": "Envoyer un rapport", "help.how": "Comment aider", "help.count": "pannes réelles reçues",
  "faq.h2": "Questions",
  q1: "Mes journaux quittent-ils mon PC ?", a1: "Non. Rien n'est envoyé nulle part. Il n'y a ni cloud ni télémétrie, et tu peux vérifier le code source.",
  q2: "L'outil peut-il toucher à l'imprimante ?", a2: "Non. Il est en lecture seule : il lit ce que l'imprimante rapporte et n'envoie jamais de commande.",
  q3: "Pourquoi pas d'IA dans l'outil ?", a3: "Parce qu'un résultat doit être rejouable, octet pour octet. Les mêmes observations et les mêmes règles donnent toujours la même réponse.",
  q4: "Est-ce un logiciel officiel Snapmaker ?", a4: "Non. C'est un projet indépendant. Chaque code renvoie à la page du wiki officiel dont il vient.",
  q5: "Sur quels systèmes tourne-t-il ?", a5: "L'app est livrée en zip Windows avec son empreinte. Le moteur est testé en CI sous Windows, Linux et macOS.",
  "app.h2": "L'app réelle, sur des données de démo.",
  "app.lead": "Écrans de la version actuelle. L'incident que tu vois est synthétique et signalé comme tel dans l'app.",
  "app.t1": "Verdict", "app.t2": "Frise", "app.t3": "Résultats", "app.t4": "Rapport",
  "app.c1": "Le verdict dit ce qui a été rapporté, combien de faits l'appuient et d'où vient la règle.",
  "app.c2": "La frise marque chaque trou dans les données au lieu de tracer une ligne par-dessus.",
  "app.c3": "Chaque résultat montre ce qui l'appuie, ce qui le contredit et ce qui manque. Pas de score.",
  "app.c4": "Avant tout export, le contrôle de confidentialité liste ce qui est retiré : adresses, numéros de série, noms de fichiers.",
  "app.sample": "Ouvrir le rapport d'exemple", "app.themes": "Quatre thèmes, mêmes faits. Un thème change l'apparence, jamais ce que dit l'app.",
  "get.h2": "Télécharge-la. Sans installateur.", "get.lead": "Un zip pour Windows. Rien à configurer, aucun compte.",
  "get.1.h": "Télécharge le zip", "get.1.p": "Depuis la dernière version sur GitHub.",
  "get.2.h": "Extrais-le avec l'Explorateur Windows", "get.2.p": "Clic droit, Extraire tout. WinRAR et 7-Zip suppriment la marque que Windows utilise pour SmartScreen. Puis double-clique sur u1-doctor.exe.",
  "get.3.h": "Essaie d'abord la démo", "get.3.p": "Active le mode Démo pour tout voir sur des données synthétiques signalées. Ouvre Diagnostiquer quand tu veux lire ta propre U1.",
  "get.guide": "Guide d'installation", "get.proof": "Vérifie par toi-même", "get.v": "Version", "get.f": "Fichier", "get.vt0": "moteurs le signalent", "get.b": "Construction",
  "get.bv": "Faite par GitHub Actions à partir du code source public, avec une attestation de build.",
  "get.note": "L'exe n'est pas signé, donc SmartScreen peut avertir. Un scan propre n'est pas une garantie : le code est public, tu peux le lire.",
  "foot.install": "Guide d'installation",
  "foot.note": "U1 Doctor est un projet indépendant, non affilié à Snapmaker. Licence MIT.", "foot.sample": "Rapport d'exemple", "foot.security": "Signaler un problème de sécurité",
  "ai.h1": "Aider U1 Doctor",
  "ai.lead": "Les règles ont été écrites à partir de la documentation officielle. Un vrai incident sur une vraie U1 est le seul moyen de voir où elles se trompent ou sont trop faibles.",
  "ai.send.h2": "Envoyer un rapport en cinq minutes",
  "ai.1.h": "Note ce qui s'est passé", "ai.1.p": "Le code d'erreur exact sous la forme dddd-dddd-dddd-dddd, la version du firmware, le moment et ce que tu as essayé.",
  "ai.2.h": "Fais une capture en lecture seule, si tu peux", "ai.2.p": "Capture depuis l'écran Diagnostiquer, puis exporte un paquet depuis l'écran Rapport. Ouvre d'abord le zip et lis ce qu'il liste.",
  "ai.3.h": "Vérifie avant de publier", "ai.3.p": "Un ticket est public et reste indexé même si tu le supprimes. Retire adresses IP, numéros de série, e-mails et noms de fichiers d'impression, y compris sur les captures d'écran.",
  "ai.4.h": "Ouvre le formulaire d'incident", "ai.4.p": "Tu l'écris et tu joins le fichier toi-même. U1 Doctor n'envoie jamais rien tout seul.",
  "ai.guide": "Lire le guide complet",
  "ai.miss.h2": "Ce qui nous manque",
  "ai.m1.h": "Une vraie panne", "ai.m1.p": "Tout incident de l'app est synthétique. Une capture réelle testerait les règles pour la première fois.",
  "ai.m2.h": "Des règles jamais déclenchées", "ai.m2.p": "Les règles S17 à S21 sont restées muettes sur une impression saine. Leur cas positif n'a jamais été vu sur une vraie imprimante.",
  "ai.m3.h": "Plus de propriétaires de U1", "ai.m3.p": "D'autres versions de firmware, d'autres filaments, d'autres montages. Dis-nous où l'app se trompe.",
  "ai.m4.h": "D'autres plateformes", "ai.m4.p": "L'app est livrée pour Windows. Un testeur sous macOS ou Linux aiderait.",
  "ai.more.h2": "Autres façons d'aider",
  "ai.issues": "Tickets ouverts", "ai.contrib": "Guide de contribution", "ai.forum": "Forum Snapmaker",
};

let lang = "en";
const dict = () => (lang === "fr" ? FR : {});

export function getLang() { return lang; }

export function applyLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n],[data-i18n-html]")) {
    const html = el.hasAttribute("data-i18n-html");
    const key = el.getAttribute(html ? "data-i18n-html" : "data-i18n");
    if (el.dataset.en === undefined) el.dataset.en = html ? el.innerHTML : el.textContent;
    const value = dict()[key] ?? el.dataset.en;
    if (html) el.innerHTML = value; else el.textContent = value;
  }
  const btn = document.getElementById("lang-l");
  if (btn) btn.textContent = lang === "fr" ? "EN" : "FR";
  // the accessible name starts with the visible text (WCAG 2.5.3)
  document.getElementById("lang")?.setAttribute("aria-label", lang === "fr" ? "EN, switch to English" : "FR, passer en français");
  try { localStorage.setItem("u1d-lang", lang); } catch { /* private mode: the choice just is not remembered */ }
  document.dispatchEvent(new CustomEvent("u1d:lang", { detail: lang }));
}

export const t = (key, fallback) => dict()[key] ?? fallback;
