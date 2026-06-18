(function () {
  const h = React.createElement;
  const { useEffect, useMemo, useState, useRef } = React;
  const root = ReactDOM.createRoot(document.getElementById("root"));

  const defaultExperiment = {
    title: "Untitled Butterfly experiment",
    protein_name: "",
    uniprot_id: "",
    protein_sequence: "",
    organism_name: "",
    expression_system: "",
    protein_size_kda: "",
    protein_load_ug: "",
    target_abundance_class: "moderate",
    lane_count: "10",
    gel_percent: "",
    membrane_type: "pvdf",
    transfer_mode: "either",
    blocking_reagent: "milk",
    primary_target: "",
    primary_company: "",
    primary_url: "",
    primary_clone: "",
    primary_host: "rabbit",
    primary_isotype: "IgG",
    primary_type: "total",
    primary_dilution: "",
    secondary_url: "",
    secondary_target_species: "rabbit",
    secondary_isotype: "IgG",
    secondary_conjugate: "HRP",
    secondary_dilution: "",
    transfer_time: "",
    transfer_current: "",
    wash_program: "",
    detection_method: "ECL",
    exposure_time: "",
    signal_rating: "3",
    background_rating: "3",
    specificity_rating: "3",
    transfer_rating: "3",
    overall_outcome: "mixed",
    notes: "",
    troubleshooting_symptom: "high background",
  };

  const metricLabels = {
    contrast: "Contrast",
    saturation_pct: "Saturation",
    lane_variation: "Lane variance",
    asymmetry_score: "Asymmetry",
    background_std: "Background spread",
    splice_risk_score: "Splice risk",
    manipulation_risk_score: "Manipulation risk",
    dynamic_range: "Dynamic range",
  };


  function App() {
    const [authChecked, setAuthChecked] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [experiment, setExperiment] = useState(defaultExperiment);
    const [analyses, setAnalyses] = useState({});
    const [recommendations, setRecommendations] = useState({});
    const [proteinFirstPlan, setProteinFirstPlan] = useState(null);
    const [proteinIntelligence, setProteinIntelligence] = useState(null);
    const [antibodyCompatibility, setAntibodyCompatibility] = useState(null);
    const [aiInterpretations, setAiInterpretations] = useState({});
    const [troubleshootingPlan, setTroubleshootingPlan] = useState(null);
    const [history, setHistory] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatQuestion, setChatQuestion] = useState("");
    const [docStatus, setDocStatus] = useState({ document_count: 0, chunk_count: 0, documents: [] });
    const [selectedId, setSelectedId] = useState(null);
    const [status, setStatus] = useState("Butterfly is ready to propose a protein-led blotting strategy.");
    const [previews, setPreviews] = useState({});
    const [proteinIntelLoading, setProteinIntelLoading] = useState(false);
    const [antibodyCompatibilityLoading, setAntibodyCompatibilityLoading] = useState(false);
    const [troubleshootingLoading, setTroubleshootingLoading] = useState(false);
    const [aiLoadingStage, setAiLoadingStage] = useState(null);
    const [chatLoading, setChatLoading] = useState(false);
    const [docUploadLoading, setDocUploadLoading] = useState(false);
    const [docActionLoading, setDocActionLoading] = useState(false);
    const [proteinFirstLoading, setProteinFirstLoading] = useState(false);
    const [assistantScanLoading, setAssistantScanLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("intel");
    const [planAbundance, setPlanAbundance] = useState("moderate");
    const [planPhospho, setPlanPhospho] = useState(false);
    const [planOverrides, setPlanOverrides] = useState({});

    useEffect(() => {
      checkAuth();
    }, []);

    useEffect(() => {
      if (authenticated) {
        fetchIndexStatus();
      }
    }, [authenticated]);

    const strategyReady = Boolean(proteinIntelligence || experiment.protein_name);

    async function checkAuth() {
      const response = await fetch("/api/auth/status");
      const payload = await response.json();
      setAuthenticated(Boolean(payload.authenticated));
      setAuthChecked(true);
    }

    async function login(password) {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        return false;
      }

      setAuthenticated(true);
      return true;
    }

    async function logout() {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthenticated(false);
      setHistory([]);
      setChatMessages([]);
      setDocStatus({ document_count: 0, chunk_count: 0, documents: [] });
      setStatus("Logged out of Butterfly.");
    }

    async function fetchHistory() {
      const response = await fetch("/api/experiments");
      const items = await response.json();
      setHistory(items);
    }


    async function fetchIndexStatus() {
      const response = await fetch("/api/index-status");
      if (!response.ok) return;
      const payload = await response.json();
      setDocStatus(payload);
    }

    function updateField(field, value) {
      setExperiment((current) => ({ ...current, [field]: value }));
    }


    if (!authChecked) {
      return h("div", { className: "app-shell" }, h("section", { className: "hero auth-hero" }, h("p", { className: "subtitle" }, "Checking Butterfly access...")));
    }

    if (!authenticated) {
      return h(LoginScreen, { onLogin: login });
    }

    async function analyseStage(stage, file) {
      if (!file) return;

      setStatus(`Analysing ${stage} image...`);
      const imageBase64 = await fileToBase64(file);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, image_base64: imageBase64.split(",")[1] }),
      });

      if (!response.ok) {
        setStatus(`Unable to analyse the ${stage} image.`);
        return;
      }

      const payload = await response.json();
      setAnalyses((current) => ({ ...current, [stage]: payload.analysis }));
      setPreviews((current) => ({ ...current, [stage]: imageBase64 }));
      setStatus(`${capitalize(stage)} image analysed.`);
    }

    async function fetchProteinIntelligence() {
      setProteinIntelLoading(true);
      setStatus("Fetching protein intelligence...");
      const response = await fetch("/api/protein-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uniprot_id: experiment.uniprot_id || null,
          protein_name: experiment.protein_name || null,
          organism_name: experiment.organism_name || null,
          protein_sequence: experiment.protein_sequence || null,
        }),
      });
      setProteinIntelLoading(false);

      if (!response.ok) {
        setStatus("Protein intelligence lookup failed.");
        return null;
      }

      const payload = await response.json();
      setProteinIntelligence(payload);
      setExperiment((current) => ({
        ...current,
        uniprot_id: current.uniprot_id || payload.resolved_accession || "",
        protein_size_kda:
          current.protein_size_kda || !payload.chemistry?.molecular_weight_kda
            ? current.protein_size_kda
            : String(Math.round(payload.chemistry.molecular_weight_kda)),
      }));
      setStatus("Protein intelligence updated.");
      return payload;
    }

    async function generateProteinFirstPlan() {
      setProteinFirstLoading(true);
      setStatus("Building a predictive model from the target protein...");
      const intel = proteinIntelligence || await fetchProteinIntelligence();
      if (!intel) {
        setProteinFirstLoading(false);
        return;
      }

      const nextExperiment = buildProteinFirstExperiment(experiment, intel);
      setExperiment(nextExperiment);

      const planResponse = await fetch("/api/protein-first-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experiment: nextExperiment,
          protein_intelligence: intel,
          antibody_compatibility: antibodyCompatibility || {},
        }),
      });

      if (!planResponse.ok) {
        let detail = "Could not build the predictive model.";
        try {
          const errorPayload = await planResponse.json();
          detail = errorPayload.detail || detail;
        } catch (error) {
          detail = "Could not build the predictive model.";
        }
        setProteinFirstLoading(false);
        setStatus(detail);
        return;
      }

      const planPayload = await planResponse.json();
      setProteinFirstPlan(planPayload);

      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: nextExperiment.title || "Untitled Butterfly experiment",
          experiment: nextExperiment,
          analyses,
        }),
      });
      setProteinFirstLoading(false);

      if (!response.ok) {
        setStatus("The predictive model loaded, but the secondary strategy cards could not be generated.");
        return;
      }

      const payload = await response.json();
      setRecommendations(payload);
      setStatus("Predictive model ready. Butterfly generated a protein-led blotting model from the protein evidence.");
    }

    async function generateRecommendations() {
      setStatus("Generating evidence-weighted blot strategy...");
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: experiment.title || "Untitled Butterfly experiment",
          experiment,
          analyses,
        }),
      });

      if (!response.ok) {
        setStatus("Could not generate recommendations.");
        return;
      }

      const payload = await response.json();
      setRecommendations(payload);
      setStatus("Predicted best strategy updated.");
    }

    async function checkAntibodyCompatibility() {
      setAntibodyCompatibilityLoading(true);
      setStatus("Checking antibody compatibility...");
      const response = await fetch("/api/antibody-compatibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_url: experiment.primary_url || null,
          secondary_url: experiment.secondary_url || null,
          primary_host_species: experiment.primary_host || null,
          primary_isotype: experiment.primary_isotype || null,
          primary_clone: experiment.primary_clone || null,
          secondary_target_species: experiment.secondary_target_species || null,
          secondary_isotype: experiment.secondary_isotype || null,
          secondary_conjugate: experiment.secondary_conjugate || null,
          detection_method: experiment.detection_method || "ECL",
          application: "WB",
        }),
      });
      setAntibodyCompatibilityLoading(false);

      if (!response.ok) {
        setStatus("Antibody compatibility check failed.");
        return;
      }

      const payload = await response.json();
      setAntibodyCompatibility(payload);
      setStatus(`Antibody compatibility: ${payload.status}.`);
    }

    async function generateTroubleshootingPlan(symptomOverride) {
      const symptom = (typeof symptomOverride === "string" && symptomOverride)
        ? symptomOverride
        : (experiment.troubleshooting_symptom || "high background");
      if (typeof symptomOverride === "string" && symptomOverride) {
        updateField("troubleshooting_symptom", symptomOverride);
      }
      setTroubleshootingLoading(true);
      setStatus("Building the full analysis...");
      const response = await fetch("/api/troubleshooting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptom,
          experiment,
          analyses,
          protein_intelligence: proteinIntelligence || {},
          antibody_compatibility: antibodyCompatibility || {},
        }),
      });
      setTroubleshootingLoading(false);

      if (!response.ok) {
        setStatus("Full analysis could not be generated.");
        return;
      }

      const payload = await response.json();
      setTroubleshootingPlan(payload);
      setStatus(`Full analysis ready for ${payload.symptom}.`);
    }

    async function scanAssistantImage(file) {
      if (!file) return;
      setAssistantScanLoading(true);
      setStatus("Scanning your blot image...");
      try {
        const imageBase64 = await fileToBase64(file);
        const raw = imageBase64.split(",")[1];

        const analyzeResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "final", image_base64: raw }),
        });
        if (!analyzeResponse.ok) {
          setAssistantScanLoading(false);
          setStatus("Could not analyse the image.");
          return;
        }
        const analyzePayload = await analyzeResponse.json();
        setAnalyses((current) => ({ ...current, final: analyzePayload.analysis }));
        setPreviews((current) => ({ ...current, final: imageBase64 }));

        const interpretResponse = await fetch("/api/ai-interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage: "final",
            image_base64: raw,
            analysis: analyzePayload.analysis,
            experiment,
            protein_intelligence: proteinIntelligence || {},
            antibody_compatibility: antibodyCompatibility || {},
          }),
        });
        if (interpretResponse.ok) {
          const interpretation = await interpretResponse.json();
          setAiInterpretations((current) => ({ ...current, final: interpretation }));
        }
        setStatus("Blot image scanned. Review the suggested steps.");
      } catch (err) {
        setStatus("Image scan failed. Please try a different image.");
      }
      setAssistantScanLoading(false);
    }

    async function generateAIInterpretation(stage) {
      const preview = previews[stage];
      if (!preview) {
        setStatus(`Upload a ${stage} image first.`);
        return;
      }

      setAiLoadingStage(stage);
      setStatus(`Running AI interpretation for the ${stage} image...`);
      const response = await fetch("/api/ai-interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          image_base64: preview.split(",")[1],
          analysis: analyses[stage] || {},
          experiment,
          protein_intelligence: proteinIntelligence || {},
          antibody_compatibility: antibodyCompatibility || {},
        }),
      });
      setAiLoadingStage(null);

      if (!response.ok) {
        setStatus(`AI interpretation failed for the ${stage} image.`);
        return;
      }

      const payload = await response.json();
      setAiInterpretations((current) => ({ ...current, [stage]: payload }));
      setStatus(`AI interpretation ready for the ${stage} image.`);
    }

    async function askButterfly() {
      if (!chatQuestion.trim()) return;
      const question = chatQuestion.trim();
      setChatLoading(true);
      setStatus("Ask Butterfly is retrieving grounded troubleshooting guidance...");
      setChatMessages((current) => [...current, { role: "user", text: question }]);
      setChatQuestion("");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          experiment,
          analyses,
          protein_intelligence: proteinIntelligence || {},
          antibody_compatibility: antibodyCompatibility || {},
        }),
      });
      setChatLoading(false);

      if (!response.ok) {
        setChatMessages((current) => [...current, { role: "assistant", text: "Butterfly could not answer that question right now." }]);
        setStatus("Ask Butterfly failed.");
        return;
      }

      const payload = await response.json();
      setChatMessages((current) => [...current, { role: "assistant", text: payload.answer, citations: payload.citations || [], mode: payload.mode }]);
      setStatus("Ask Butterfly response ready.");
    }

    async function uploadDocuments(fileList) {
      if (!fileList || !fileList.length) return;
      setDocUploadLoading(true);
      setStatus("Indexing uploaded documents for the virtual assistant...");
      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append("files", file));
      const response = await fetch("/api/index-documents", {
        method: "POST",
        body: formData,
      });
      setDocUploadLoading(false);
      if (!response.ok) {
        setStatus("Document indexing failed.");
        return;
      }
      const payload = await response.json();
      setDocStatus(payload.status);
      setStatus(`Indexed ${payload.indexed.length} document(s) for the virtual assistant.`);
    }

    async function deleteIndexedDocument(filename) {
      setDocActionLoading(true);
      setStatus(`Removing ${filename} from Ask Butterfly...`);
      const response = await fetch("/api/delete-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      setDocActionLoading(false);
      if (!response.ok) {
        setStatus("Document removal failed.");
        return;
      }
      const payload = await response.json();
      setDocStatus(payload.status);
      setStatus(`Removed ${filename} from Ask Butterfly.`);
    }

    async function rebuildIndex() {
      setDocActionLoading(true);
      setStatus("Rebuilding Ask Butterfly index...");
      const response = await fetch("/api/rebuild-index", { method: "POST" });
      setDocActionLoading(false);
      if (!response.ok) {
        setStatus("Index rebuild failed.");
        return;
      }
      const payload = await response.json();
      setDocStatus(payload.status);
      setStatus("Ask Butterfly index rebuilt.");
    }

    async function saveExperiment() {
      setStatus(selectedId ? "Updating experiment..." : "Saving experiment...");
      const method = selectedId ? "PUT" : "POST";
      const url = selectedId ? `/api/experiments/${selectedId}` : "/api/experiments";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: experiment.title || "Untitled Butterfly experiment",
          experiment,
          analyses,
          recommendations,
          protein_first_plan: proteinFirstPlan || {},
          protein_intelligence: proteinIntelligence || {},
          antibody_compatibility: antibodyCompatibility || {},
          ai_interpretations: aiInterpretations || {},
          troubleshooting_plan: troubleshootingPlan || {},
        }),
      });

      if (!response.ok) {
        setStatus("Save failed.");
        return;
      }

      const payload = await response.json();
      setSelectedId(payload.id);
      setStatus(`Saved experiment #${payload.id}.`);
      fetchHistory();
    }

    async function loadExperiment(item) {
      const response = await fetch(`/api/experiments/${item.id}`);
      const payload = await response.json();
      setSelectedId(payload.id);
      setExperiment({ ...defaultExperiment, ...payload.payload.experiment });
      setAnalyses(payload.payload.analyses || {});
      setRecommendations(payload.payload.recommendations || {});
      setProteinFirstPlan(payload.payload.protein_first_plan || null);
      setProteinIntelligence(payload.payload.protein_intelligence || null);
      setAntibodyCompatibility(payload.payload.antibody_compatibility || null);
      setAiInterpretations(payload.payload.ai_interpretations || {});
      setTroubleshootingPlan(payload.payload.troubleshooting_plan || null);
      setChatMessages([]);
      setStatus(`Loaded experiment #${payload.id}.`);
    }

    function startNew() {
      setSelectedId(null);
      setExperiment(defaultExperiment);
      setAnalyses({});
      setRecommendations({});
      setProteinFirstPlan(null);
      setProteinIntelligence(null);
      setAntibodyCompatibility(null);
      setAiInterpretations({});
      setTroubleshootingPlan(null);
      setChatMessages([]);
      setPreviews({});
      setStatus("Started a fresh Butterfly experiment.");
    }

    const tabs = [
      ["intel", "Protein Intelligence"],
      ["strategy", "WB Predictive Strategy"],
      ["antibody", "Antibody Compatibility"],
      ["assistant", "Virtual Assistant"],
      ["plan", "Run Plan & Guide"],
    ];

    let panel = null;
    if (activeTab === "intel") {
      panel = h(ProteinIntelligenceSection, {
        number: "01",
        experiment,
        updateField,
        proteinIntelligence,
        onFetchProteinIntelligence: fetchProteinIntelligence,
        onGenerateProteinFirstPlan: generateProteinFirstPlan,
        proteinIntelLoading,
        proteinFirstLoading,
        onNextStage: () => setActiveTab("strategy"),
      });
    } else if (activeTab === "strategy") {
      panel = h(PredictedStrategySection, {
        number: "02",
        proteinIntelligence,
        abundance: planAbundance,
        phospho: planPhospho,
        overrides: planOverrides,
        setAbundance: setPlanAbundance,
        setPhospho: setPlanPhospho,
        setOverrides: setPlanOverrides,
      });
    } else if (activeTab === "antibody") {
      panel = h(AntibodyCompatibilitySection, {
        number: "03",
        experiment,
        updateField,
        antibodyCompatibility,
        onCheck: checkAntibodyCompatibility,
        loading: antibodyCompatibilityLoading,
        proteinIntelligence,
      });
    } else if (activeTab === "assistant") {
      panel = h(VirtualAssistantSection, {
        number: "04",
        experiment,
        updateField,
        analyses,
        troubleshootingPlan,
        onGenerate: generateTroubleshootingPlan,
        loading: troubleshootingLoading,
        docStatus,
        onUploadDocuments: uploadDocuments,
        docUploadLoading,
        proteinIntelligence,
        onScanImage: scanAssistantImage,
        scanLoading: assistantScanLoading,
        scanResult: aiInterpretations.final,
        scanPreview: previews.final,
      });
    } else if (activeTab === "plan") {
      panel = h(RunPlanSection, {
        number: "05",
        proteinIntelligence,
        abundance: planAbundance,
        phospho: planPhospho,
        overrides: planOverrides,
      });
    }

    return h(
      "div",
      { className: "app-shell" },
      h(Hero, { onLogout: logout }),
      h(
        "div",
        { className: "tabbar" },
        tabs.map(([key, label], idx) =>
          h(
            "button",
            { key, type: "button", className: activeTab === key ? "tabbtn tabbtn-on" : "tabbtn", onClick: () => setActiveTab(key) },
            h("span", { className: "tabbtn-num" }, String(idx + 1)),
            h("span", { className: "tabbtn-label" }, label)
          )
        )
      ),
      h("div", { className: "tab-panel" }, panel)
    );
  }

  function LoginScreen({ onLogin }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function submit(event) {
      event.preventDefault();
      setLoading(true);
      setError("");
      const ok = await onLogin(password);
      setLoading(false);
      if (!ok) {
        setError("That password did not work. Please try again.");
      }
    }

    return h(
      "div",
      { className: "app-shell auth-shell" },
      h(
        "section",
        { className: "hero auth-hero" },
        h(
          "div",
          { className: "hero-copy" },
          h("p", { className: "eyebrow" }, "Private Butterfly Access"),
          h("h1", null, "Butterfly"),
          h("p", { className: "subtitle" }, "This prototype is password protected so only invited users can access the Western blot optimisation workspace.")
        ),
        h(
          "form",
          { className: "login-card", onSubmit: submit },
          h("p", { className: "tiny-label" }, "Enter password"),
          h("input", { type: "password", value: password, onChange: (event) => setPassword(event.target.value), placeholder: "Butterfly password", autoFocus: true }),
          error ? h("p", { className: "auth-error" }, error) : null,
          h("button", { className: "button button-primary", type: "submit", disabled: loading || !password }, loading ? "Opening Butterfly..." : "Open Butterfly")
        )
      )
    );
  }

  function Hero({ onLogout }) {
    return h(
      "section",
      { className: "hero" },
      h(
        "div",
        { className: "hero-copy" },
        h("p", { className: "eyebrow" }, "Protein-led Western Blot Optimisation"),
        h("h1", null, "Butterfly"),
        h(
          "p",
          { className: "subtitle" },
          "A virtual Western blot troubleshooting assistant that turns protein intelligence, antibody evidence, and image analysis into an evidence-weighted strategy for the next blot."
        ),
        h("div", { className: "button-row" }, h("button", { className: "button button-ghost", type: "button", onClick: onLogout }, "Log out"))
      ),
      h(
        "div",
        { className: "hero-visual" },
        h("div", { className: "brand-mark-shell" }, h("img", { src: "/assets/Butterfly-logo-v7.jpg?v=7", alt: "Rorschach western blot butterfly mark", className: "brand-mark" }))
      )
    );
  }

  function ProteinIntelligenceSection({ number, experiment, updateField, proteinIntelligence, onFetchProteinIntelligence, onGenerateProteinFirstPlan, proteinIntelLoading, proteinFirstLoading, onNextStage }) {
    return h(
      SectionCard,
      {
        number,
        title: "Protein Intelligence",
        subtitle:
          "Start here. Input a UniProt ID and/or FASTA sequence, then review the protein evidence before moving to the predictive model stage.",
      },
      h(
        "div",
        { className: "stage-one-layout" },
        h(
          "div",
          { className: "plan-card" },
          h(StageFlowChart, {
            items: [
              ["1", "Input protein"],
              ["2", "Review intelligence"],
              ["3", "Move to model"],
            ],
          }),
          h(
            "div",
            { className: "intel-required-note" },
            h("strong", null, "To begin, give Butterfly one of two things:"),
            " a ", h("span", { className: "intel-req-em" }, "UniProt ID"), " or a pasted ", h("span", { className: "intel-req-em" }, "FASTA sequence"), ". Either one is enough — everything else is optional."
          ),
          h(
            "div",
            { className: "entry-card-grid" },
            h(
              FieldGroup,
              { title: "Option A · UniProt ID", copy: "Fastest route — Butterfly pulls identity, structure, and features automatically." },
              renderInput("UniProt ID", experiment.uniprot_id, (value) => updateField("uniprot_id", value)),
              renderInput("Experiment title (optional)", experiment.title, (value) => updateField("title", value)),
              renderInput("Target protein (optional)", experiment.protein_name, (value) => updateField("protein_name", value)),
              renderInput("Organism (optional)", experiment.organism_name, (value) => updateField("organism_name", value)),
              renderInput("Expression system (optional)", experiment.expression_system, (value) => updateField("expression_system", value))
            ),
            h(
              FieldGroup,
              { title: "Option B · FASTA sequence", copy: "Use this if you don't have a UniProt ID, or want sequence-led prediction." },
              renderTextAreaInput("FASTA / protein sequence", experiment.protein_sequence, (value) => updateField("protein_sequence", value), "Paste an amino-acid or FASTA sequence. Enough on its own to generate protein intelligence.")
            )
          ),
          h(
            "div",
            { className: "button-row intel-fetch-row" },
            h("button", { className: "button button-primary", type: "button", onClick: onFetchProteinIntelligence, disabled: proteinIntelLoading || !(experiment.uniprot_id || experiment.protein_name || experiment.protein_sequence) }, proteinIntelLoading ? "Loading protein intelligence..." : "Fetch / predict protein intelligence"),
            !proteinIntelLoading && !(experiment.uniprot_id || experiment.protein_name || experiment.protein_sequence)
              ? h("span", { className: "intel-fetch-hint" }, "Enter a UniProt ID or FASTA sequence to continue.")
              : null
          )
        ),
        h(
          "div",
          { className: "intel-card" },
          h(StageFlowChart, {
            compact: true,
            items: [
              ["UniProt", "Identity"],
              ["AlphaFold", "Structure"],
              ["EBI/PDB", "Features"],
              ["AI", "WB plan"],
            ],
          }),
          h("p", { className: "tiny-label" }, "Predictive protein intelligence"),
          h("div", { className: "tag-row" }, tag("UniProt"), tag("FASTA"), tag("AlphaFold"), tag("EMBL-EBI"), tag("PDB context"), tag("Protein chemistry")),
          proteinIntelligence
            ? h(ProteinIntelligencePane, { proteinIntelligence })
            : proteinIntelLoading
            ? h("div", { className: "empty-state" }, h("p", { style: { fontSize: "16px", fontWeight: "500" } }, "🔬 Fetching protein intelligence..."), h("p", { style: { fontSize: "13px", color: "#666", marginTop: "8px" } }, "Retrieving data from UniProt, AlphaFold, and EMBL-EBI (this takes ~3 seconds)"))
            : h("div", { className: "empty-state" }, "Start by entering a UniProt ID, FASTA sequence, or both. Butterfly will then show predictive protein intelligence for you to review before moving to the predictive model."),
          proteinIntelligence
            ? h(
                "div",
                { className: "next-stage-cta" },
                h(
                  "div",
                  { className: "next-stage-copy" },
                  h("p", { className: "next-stage-label" }, "Next stage"),
                  h("p", { className: "next-stage-text" }, "Protein intelligence is ready. Continue to ", h("strong", null, "WB Predictive Strategy"), " to turn this into a full protocol with reasoning.")
                ),
                h("button", { className: "button button-primary next-stage-btn", type: "button", onClick: onNextStage }, "Continue to WB Predictive Strategy →")
              )
            : null
        )
      )
    );
  }

  // Turn Step 1 protein intelligence into concrete, adjustable protocol
  // decisions. Each decision is derived from the protein's own chemistry, with
  // the reasoning shown and alternatives the scientist can switch to.
  function buildProtocolDecisions(proteinIntelligence, ctx) {
    const chem = (proteinIntelligence && proteinIntelligence.chemistry) || {};
    const counts = (proteinIntelligence && proteinIntelligence.ebi_features && proteinIntelligence.ebi_features.counts) || {};
    const mw = Number(chem.molecular_weight_kda || 0);
    const pI = chem.theoretical_pI;
    const hydrophobic = chem.membrane_retention_risk === "high" || Number(chem.hydrophobic_domain_count || 0) > 0 || Number(chem.hydrophobic_fraction || 0) >= 0.38;
    const aggregation = chem.aggregation_risk === "high" || chem.aggregation_risk === "moderate";
    const glyco = Number(chem.glycosylation_sites || counts.CARBOHYD || 0) > 0;
    const processed = Number(chem.cleavage_site_count || 0) > 0 || Number(counts.SIGNAL || 0) > 0;
    const abundance = ctx.abundance; // low | moderate | high
    const phospho = ctx.phospho;

    const gel = mw >= 150 ? "6%" : mw >= 100 ? "7.5%" : mw >= 60 ? "8%" : mw >= 35 ? "10%" : mw >= 20 ? "12%" : "15%";
    const pore = mw && mw < 40 ? "0.2 µm" : "0.45 µm";
    const membrane = hydrophobic ? "PVDF" : "Nitrocellulose";
    const loadVal = abundance === "low" ? "30–50 µg" : abundance === "high" ? "5–15 µg" : "15–25 µg";
    const prepVal = aggregation || hydrophobic ? "Reducing Laemmli; heat 70 °C / 10 min (do NOT boil)" : "Reducing Laemmli; heat 95 °C / 5 min";
    const transferVal = mw >= 100 ? "Wet transfer, 90 min (or overnight 4 °C), 10% methanol" : mw <= 25 ? "Semi-dry or wet, 30–45 min" : "Wet transfer, 60–90 min";
    const blockingVal = phospho || glyco ? "3–5% BSA in TBST, 1 h RT" : "5% non-fat milk in TBST, 1 h RT";
    const primaryVal = abundance === "low" ? "Start 1:500–1:1000, overnight 4 °C" : abundance === "high" ? "Start 1:2000–1:5000, 1 h RT" : "Start 1:1000, overnight 4 °C";
    const washVal = phospho ? "4 × 5 min TBST" : abundance === "low" ? "3 × 5 min TBST (don't over-wash)" : "3 × 5–10 min TBST";
    const detectionVal = abundance === "low" ? "High-sensitivity ECL; capture an exposure series" : "Standard ECL; short→long exposure series";

    return [
      {
        id: "prep",
        title: "Sample preparation",
        value: prepVal,
        why: aggregation || hydrophobic
          ? `Aggregation/membrane risk is elevated — boiling can aggregate this protein, so denature gently.`
          : `Standard globular protein — full denaturation at 95 °C is fine.`,
        options: ["Reducing Laemmli; heat 95 °C / 5 min", "Reducing Laemmli; heat 70 °C / 10 min (do NOT boil)", "Reducing Laemmli; 37 °C / 30 min (membrane protein)", "Non-reducing (native epitope)"],
      },
      {
        id: "gel",
        title: "Gel percentage",
        value: `${gel} SDS-PAGE`,
        why: `Predicted MW ≈ ${mw || "?"} kDa — ${gel} resolves this size range best.`,
        options: ["6% SDS-PAGE", "7.5% SDS-PAGE", "8% SDS-PAGE", "10% SDS-PAGE", "12% SDS-PAGE", "15% SDS-PAGE", "4–20% gradient"],
      },
      {
        id: "load",
        title: "Sample load per lane",
        value: loadVal,
        why: `Target abundance is ${abundance}${mw >= 100 ? "; larger proteins benefit from a little more load" : ""}.`,
        options: ["5–15 µg", "15–25 µg", "30–50 µg"],
      },
      {
        id: "membrane",
        title: "Membrane",
        value: `${membrane}, ${pore}`,
        why: `${hydrophobic ? "Hydrophobic / membrane-associated → PVDF binds it better. " : "Largely soluble → either membrane works. "}${mw && mw < 40 ? "Small target → 0.2 µm avoids blow-through." : "0.45 µm is fine for this size."}`,
        options: ["PVDF, 0.45 µm", "PVDF, 0.2 µm", "Nitrocellulose, 0.45 µm", "Nitrocellulose, 0.2 µm"],
      },
      {
        id: "transfer",
        title: "Transfer",
        value: transferVal,
        why: mw >= 100
          ? `Large protein (${mw} kDa) transfers slowly — longer/wet transfer with less methanol helps it move.`
          : mw <= 25
          ? `Small protein (${mw} kDa) transfers fast — watch for blow-through.`
          : `Mid-size protein — standard wet transfer.`,
        options: ["Wet transfer, 60–90 min", "Wet transfer, 90 min, 10% methanol", "Wet transfer, overnight 4 °C", "Semi-dry, 30–45 min"],
      },
      {
        id: "blocking",
        title: "Blocking",
        value: blockingVal,
        why: phospho
          ? "Phospho-specific antibody — milk phospho-proteins raise background, so use BSA."
          : glyco
          ? "Glycoprotein — BSA avoids milk lectin-like interactions."
          : "Standard target — milk is an economical first choice.",
        options: ["5% non-fat milk in TBST", "3–5% BSA in TBST", "5% milk + 0.1% Tween", "Commercial blocking buffer"],
      },
      {
        id: "primary",
        title: "Primary antibody",
        value: primaryVal,
        why: `Abundance is ${abundance} — ${abundance === "low" ? "start more concentrated and incubate cold/overnight" : abundance === "high" ? "start dilute to avoid saturation" : "a 1:1000 overnight is a safe first pass"}.`,
        options: ["Start 1:500–1:1000, overnight 4 °C", "Start 1:1000, overnight 4 °C", "Start 1:2000–1:5000, 1 h RT", "Manufacturer's recommended dilution"],
      },
      {
        id: "wash",
        title: "Washing",
        value: washVal,
        why: phospho ? "Phospho workflows benefit from thorough washing." : abundance === "low" ? "Low-abundance signal is easily over-washed — keep it gentle." : "Standard washing.",
        options: ["3 × 5 min TBST", "3 × 5–10 min TBST", "4 × 5 min TBST"],
      },
      {
        id: "detection",
        title: "Detection",
        value: detectionVal,
        why: abundance === "low" ? "Low-abundance target needs a sensitive substrate." : "Standard ECL with an exposure series prevents saturation.",
        options: ["Standard ECL", "High-sensitivity ECL", "Fluorescent secondary"],
      },
      {
        id: "controls",
        title: "Controls & expected band",
        value: `Expected ≈ ${mw || "?"} kDa; run a positive-control lysate${processed ? "; expect possible lower processed bands" : ""}${glyco ? "; glyco band may run higher" : ""}.`,
        why: "Anchors interpretation and distinguishes real bands from artefacts.",
        options: [],
      },
    ];
  }

  function ProtocolPlanner({ proteinIntelligence, abundance, phospho, overrides, setAbundance, setPhospho, setOverrides }) {
    const ready = proteinIntelligence && proteinIntelligence.chemistry && proteinIntelligence.chemistry.molecular_weight_kda;
    const [copied, setCopied] = useState(false);

    if (!ready) {
      return h("div", { className: "empty-state" }, "Run Protein Intelligence in Stage 1 first — Butterfly builds the protocol from your protein's size, charge, hydrophobicity, processing and glycosylation.");
    }

    const decisions = buildProtocolDecisions(proteinIntelligence, { abundance, phospho });
    const valueFor = (d) => overrides[d.id] || d.value;

    function copyProtocol() {
      const lines = ["Butterfly recommended Western blot protocol", ""];
      decisions.forEach((d) => lines.push(`${d.title}: ${valueFor(d)}`));
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(lines.join("\n")).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }, () => {});
        }
      } catch (err) {
        /* ignore */
      }
    }

    const chipRow = (label, value, current, setter, opts) =>
      h(
        "div",
        { className: "proto-ctx-group" },
        h("span", { className: "proto-ctx-label" }, label),
        h(
          "div",
          { className: "proto-ctx-chips" },
          opts.map((o) =>
            h(
              "button",
              { key: String(o.val), type: "button", className: current === o.val ? "proto-chip proto-chip-on" : "proto-chip", onClick: () => setter(o.val) },
              o.label
            )
          )
        )
      );

    const chem = proteinIntelligence.chemistry || {};
    const counts = (proteinIntelligence.ebi_features && proteinIntelligence.ebi_features.counts) || {};
    const identity = proteinIntelligence.uniprot || {};
    const mw = Number(chem.molecular_weight_kda || 0);
    const pIv = chem.theoretical_pI;
    const hydrophobic = chem.membrane_retention_risk === "high" || Number(chem.hydrophobic_domain_count || 0) > 0 || Number(chem.hydrophobic_fraction || 0) >= 0.38;
    const glyco = Number(chem.glycosylation_sites || counts.CARBOHYD || 0);
    const processed = Number(chem.cleavage_site_count || 0) > 0 || Number(counts.SIGNAL || 0) > 0;
    const af = proteinIntelligence.alphafold || {};

    const known = [
      ["Size", mw ? `${Math.round(mw)} kDa` : "n/a"],
      ["Charge (pI)", pIv != null && pIv !== "" ? `${pIv} (${pIv < 5.5 ? "acidic" : pIv <= 8 ? "neutral" : "basic"})` : "n/a"],
      ["Solubility", hydrophobic ? "Hydrophobic / membrane" : "Soluble"],
      ["Aggregation", chem.aggregation_risk || "n/a"],
      ["Glycosylation", glyco > 0 ? `${glyco} site(s)` : "None predicted"],
      ["Processing", processed ? "Cleavage / signal sites" : "None notable"],
      ["Structure", af.available ? `${af.confidence_label} · pLDDT ${af.mean_plddt}` : "n/a"],
    ];

    // Accessible epitope region from real topology features.
    const rawFeatures = (proteinIntelligence.ebi_features && proteinIntelligence.ebi_features.examples) || [];
    const seqLen = Number(identity.sequence_length || chem.sequence_length || 0);
    const avoidTypes = { TRANSMEM: 1, INTRAMEM: 1, SIGNAL: 1, PROPEP: 1, TRANSIT: 1 };
    const avoid = rawFeatures
      .map((f) => ({ type: f.type, begin: Number(f.begin), end: Number(f.end) }))
      .filter((f) => avoidTypes[f.type] && Number.isFinite(f.begin) && Number.isFinite(f.end) && f.end >= f.begin)
      .sort((a, b) => a.begin - b.begin);
    let bestRegion = null;
    if (seqLen) {
      const acc = [];
      let cur = 1;
      avoid.forEach((f) => {
        if (f.begin > cur) acc.push({ begin: cur, end: f.begin - 1 });
        cur = Math.max(cur, f.end + 1);
      });
      if (cur <= seqLen) acc.push({ begin: cur, end: seqLen });
      acc.forEach((s) => {
        if (!bestRegion || s.end - s.begin > bestRegion.end - bestRegion.begin) bestRegion = s;
      });
    }
    const targetName = identity.protein_name || proteinIntelligence.resolved_accession || "your target";
    const abStrategy = [
      bestRegion && avoid.length
        ? `Target an epitope in an accessible region — the largest is residues ${bestRegion.begin}–${bestRegion.end}. Avoid transmembrane/signal stretches (buried in the membrane or cleaved off).`
        : "Most of the chain is accessible — pick an epitope unique to your protein and away from conserved family motifs.",
      "Choose a primary raised in a species different from your sample, and match the secondary to that host. A validated recombinant/monoclonal gives the cleanest single band; a polyclonal gives stronger but multi-epitope signal.",
      glyco > 0 ? "Glycoprotein — prefer antibodies validated on the native form; the band may shift with glycosylation." : null,
      `Find validated options: search CiteAb or BenchSci for “${targetName} western blot”, favouring antibodies with WB validation images and citations.`,
    ].filter(Boolean);

    const groups = [
      { title: "Sample preparation", ids: ["prep"] },
      { title: "Electrophoresis strategy", ids: ["gel", "load", "controls"] },
      { title: "Transfer & blocking", ids: ["membrane", "transfer", "blocking", "wash"] },
      { title: "Recommended antibody strategy", ids: ["primary", "detection"] },
    ];

    const cardFor = (d) =>
      h(
        "div",
        { className: "proto-card", key: d.id },
        h("p", { className: "proto-card-title" }, d.title),
        h("p", { className: "proto-card-value" }, valueFor(d)),
        h(
          "div",
          { className: "proto-card-whyrow" },
          h("span", { className: "proto-why-tag" }, "Why"),
          h("p", { className: "proto-card-why" }, d.why)
        ),
        d.options && d.options.length
          ? h(
              "div",
              { className: "proto-switch" },
              h("p", { className: "proto-switch-label" }, "Switch to"),
              h(
                "div",
                { className: "proto-options" },
                d.options.map((opt) =>
                  h(
                    "button",
                    {
                      key: opt,
                      type: "button",
                      className: valueFor(d) === opt ? "proto-opt proto-opt-on" : "proto-opt",
                      onClick: () => setOverrides((prev) => ({ ...prev, [d.id]: opt })),
                    },
                    opt
                  )
                )
              )
            )
          : null
      );

    return h(
      "div",
      { className: "dtree proto-planner" },
      h(
        "div",
        { className: "proto-context" },
        h("p", { className: "proto-context-head" }, "Butterfly cannot determine these parameters from the sequence alone — please select the most appropriate options"),
        h("p", { className: "proto-context-sub" }, "Your answers tune the load, blocking, antibody and detection choices below. Tap to select."),
        h(
          "div",
          { className: "proto-context-rows" },
          chipRow("How abundant is your target in the sample?", abundance, abundance, setAbundance, [
            { val: "low", label: "Low / rare" },
            { val: "moderate", label: "Moderate" },
            { val: "high", label: "High" },
          ]),
          chipRow("What kind of primary antibody?", phospho, phospho, setPhospho, [
            { val: false, label: "Total protein" },
            { val: true, label: "Phospho-specific" },
          ])
        )
      ),
      h(
        "div",
        { className: "intel-apple-card proto-known" },
        h("p", { className: "intel-why-kicker" }, "What we know from your protein"),
        h("p", { className: "domain-sub" }, "These Stage 1 properties drive every recommendation below."),
        h(
          "div",
          { className: "proto-known-grid" },
          known.map((kv, i) =>
            h(
              "div",
              { className: "proto-known-item", key: i },
              h("span", { className: "proto-known-label" }, kv[0]),
              h("span", { className: "proto-known-value" }, String(kv[1]))
            )
          )
        )
      ),
      groups.map((g, gi) =>
        h(
          "div",
          { className: "proto-section", key: gi },
          h("p", { className: "proto-group-title" }, g.title),
          h("div", { className: "proto-grid" }, decisions.filter((d) => g.ids.indexOf(d.id) !== -1).map(cardFor)),
          g.ids.indexOf("primary") !== -1
            ? h(
                "div",
                { className: "intel-apple-card proto-ab" },
                h("p", { className: "intel-why-kicker" }, "How to choose the antibody"),
                h("ul", { className: "proto-ab-list" }, abStrategy.map((t, i) => h("li", { key: i }, t))),
                h("p", { className: "proto-ab-note" }, "This tells you what to look for. The next tab — Antibody Compatibility — checks a specific antibody you've chosen (paste its product URL) for host/isotype/secondary match and validation evidence. Different jobs: here you decide what to buy; there you verify what you bought.")
              )
            : null
        )
      ),
      h(
        "div",
        { className: "proto-actions" },
        h("button", { type: "button", className: "dtree-detail-btn", onClick: copyProtocol }, copied ? "Protocol copied ✓" : "Copy full protocol")
      )
    );
  }

  const WB_GUIDE = [
    {
      title: "How a Western blot works (end to end)",
      steps: [
        "Sample prep & lysis — extract protein, add reducing Laemmli buffer, denature.",
        "SDS-PAGE — separate proteins by molecular weight.",
        "Transfer — move proteins from gel onto a PVDF or nitrocellulose membrane.",
        "Blocking — coat the membrane to prevent non-specific antibody binding.",
        "Primary antibody — binds your target.",
        "Wash — remove unbound primary.",
        "Secondary antibody — anti-host, carries the reporter (e.g. HRP).",
        "Wash — remove unbound secondary.",
        "Detection — ECL or fluorescence; capture on a CCD/CMOS imager.",
        "Analysis — read band size against the ladder and normalise to a loading control.",
      ],
    },
    {
      title: "Loading controls & normalisation",
      bullets: [
        "Use a loading control to show lanes carry comparable protein: a housekeeping protein (GAPDH, β-actin, tubulin, vinculin) or — increasingly preferred — a total-protein stain (Ponceau, stain-free, REVERT).",
        "Total-protein normalisation is more robust than a single housekeeping gene, which can change with treatment, tissue or disease.",
        "Pick a control at a different molecular weight from your target so both resolve cleanly.",
        "Housekeeping proteins are very abundant and saturate easily — keep them in the linear range or use total protein instead.",
      ],
    },
    {
      title: "Signal-to-noise & CCD/CMOS imaging",
      bullets: [
        "Signal-to-noise (S/N) is your band relative to background — maximise it with good blocking, thorough washing, and the right exposure, not by over-staining.",
        "Capture within the imager's linear dynamic range. Saturated pixels cap the true signal and make quantification invalid.",
        "Take an exposure series and use the frame where the strongest band of interest is still below saturation.",
        "Cooled CCD/CMOS sensors lower read-noise for faint blots; pixel binning boosts sensitivity at the cost of resolution.",
        "Keep the raw 16-bit TIFF. Never apply non-linear brightness/contrast or local edits to a blot you intend to quantify or publish.",
      ],
    },
    {
      title: "Quantification caveats",
      bullets: [
        "Only quantify within the linear range — signal must be proportional to protein amount. ECL saturates quickly.",
        "Exclude saturated bands; run a dilution/standard series to confirm linearity for your sample.",
        "Normalise every target band to total protein or a validated loading control on the same blot.",
        "Report uncropped originals and avoid over-interpreting small fold-changes.",
      ],
    },
    {
      title: "Glossary",
      glossary: [
        ["SDS-PAGE", "Gel electrophoresis that separates denatured proteins by size."],
        ["PVDF / Nitrocellulose", "Membrane types proteins are transferred onto; PVDF binds more protein and suits hydrophobic targets."],
        ["Blocking", "Coating the membrane (milk/BSA) to stop antibodies sticking non-specifically."],
        ["Epitope", "The specific region of the protein an antibody recognises."],
        ["Isotype", "The antibody class (e.g. IgG); the secondary must match the primary's host and class."],
        ["ECL", "Enhanced chemiluminescence — HRP-based light detection."],
        ["pI", "Isoelectric point — the pH at which the protein has no net charge."],
        ["Loading control", "A reference signal showing lanes are evenly loaded."],
        ["Linear range", "The signal window where intensity is proportional to protein amount."],
        ["pLDDT", "AlphaFold's per-residue confidence score (0–100) for the predicted structure."],
      ],
    },
  ];

  function RunPlanSection({ number, proteinIntelligence, abundance, phospho, overrides }) {
    const ready = proteinIntelligence && proteinIntelligence.chemistry && proteinIntelligence.chemistry.molecular_weight_kda;
    const identity = (proteinIntelligence && proteinIntelligence.uniprot) || {};
    const chem = (proteinIntelligence && proteinIntelligence.chemistry) || {};
    const targetName = identity.protein_name || (proteinIntelligence && proteinIntelligence.resolved_accession) || "your target";
    const decisions = ready ? buildProtocolDecisions(proteinIntelligence, { abundance, phospho }) : [];
    const valueFor = (d) => (overrides && overrides[d.id]) || d.value;

    const guideEls = WB_GUIDE.map((g, gi) =>
      h(
        "div",
        { className: "runplan-block", key: `g-${gi}` },
        h("h3", { className: "runplan-h3" }, g.title),
        g.steps
          ? h("ol", { className: "runplan-steps" }, g.steps.map((s, i) => h("li", { key: i }, s)))
          : null,
        g.bullets
          ? h("ul", { className: "runplan-list" }, g.bullets.map((s, i) => h("li", { key: i }, s)))
          : null,
        g.glossary
          ? h(
              "dl",
              { className: "runplan-glossary" },
              g.glossary.map((row, i) => h(React.Fragment, { key: i }, h("dt", null, row[0]), h("dd", null, row[1])))
            )
          : null
      )
    );

    return h(
      SectionCard,
      { number, title: "Run Plan & Guide", subtitle: "Your protocol and a Western blot reference in one place — print or save as PDF for your lab book." },
      h(
        "div",
        { className: "runplan" },
        h(
          "div",
          { className: "runplan-actions no-print" },
          h("button", { className: "button button-primary", type: "button", onClick: () => window.print() }, "Print / Save as PDF")
        ),
        h(
          "div",
          { className: "print-area" },
          h(
            "div",
            { className: "runplan-head" },
            h("h2", { className: "runplan-h2" }, "Western blot run plan"),
            ready
              ? h("p", { className: "runplan-meta" }, [targetName, proteinIntelligence.resolved_accession, chem.molecular_weight_kda ? `${Math.round(chem.molecular_weight_kda)} kDa` : null].filter(Boolean).join("  ·  "))
              : null
          ),
          ready
            ? h(
                "div",
                { className: "runplan-block" },
                h("h3", { className: "runplan-h3" }, "Recommended protocol"),
                h(
                  "table",
                  { className: "runplan-table" },
                  h(
                    "tbody",
                    null,
                    decisions.map((d) => h("tr", { key: d.id }, h("th", null, d.title), h("td", null, valueFor(d))))
                  )
                ),
                h("p", { className: "runplan-note" }, "Settings reflect your Stage 2 selections and protein chemistry. Adjust on the bench as your results dictate.")
              )
            : h("div", { className: "empty-state" }, "Run Protein Intelligence (Stage 1) and set your options in WB Predictive Strategy (Stage 2) — your personalised protocol will compile here above the reference guide."),
          h("div", { className: "runplan-divider" }, h("span", null, "Western blot reference")),
          guideEls
        )
      )
    );
  }

  function PredictedStrategySection({ number, proteinIntelligence, abundance, phospho, overrides, setAbundance, setPhospho, setOverrides }) {
    return h(
      SectionCard,
      { number, title: "Predictive Protocol Strategy", subtitle: "Butterfly has used the protein sequence to generate a protocol with specific reasoning." },
      h(ProtocolPlanner, { proteinIntelligence, abundance, phospho, overrides, setAbundance, setPhospho, setOverrides })
    );
  }

  function ExperimentLogSection({ number, experiment, updateField, analyses, previews, onUpload, onAIInterpret, aiInterpretations, aiLoadingStage }) {
    const blockingInsight = buildBlockingInsight(experiment);
    return h(
      SectionCard,
      { number, title: "Experiment Log", subtitle: "Intermediate evidence is optional. Log what you actually did so Butterfly can compare repeat runs, track what worked, and suggest the next troubleshooting decision." },
      h(
        "div",
        { className: "lookup-card" },
        h("p", { className: "tiny-label" }, "Predictive blocking context"),
        h("strong", null, blockingInsight.title),
        h("p", { className: "status" }, blockingInsight.copy)
      ),
      h(
        "div",
        { className: "experiment-log-columns" },
        h(
          "div",
          { className: "stack experiment-log-column" },
          h(
            FieldGroup,
            { title: "Gel And Load Setup", copy: "After reviewing Butterfly's predicted strategy, record the practical gel and loading setup you actually choose for the run." },
            renderInput("Protein size (kDa)", experiment.protein_size_kda, (value) => updateField("protein_size_kda", value), "number"),
            renderInput("Load per lane (ug)", experiment.protein_load_ug, (value) => updateField("protein_load_ug", value), "number"),
            renderSelect("Target abundance", experiment.target_abundance_class, (value) => updateField("target_abundance_class", value), [["very low", "Very low"], ["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["very high", "Very high"]]),
            renderInput("Lane count", experiment.lane_count, (value) => updateField("lane_count", value), "number"),
            renderInput("Gel percentage", experiment.gel_percent, (value) => updateField("gel_percent", value), "number")
          ),
          h(
            FieldGroup,
            { title: "Transfer And Wash", copy: "Record the physical conditions that most often explain uneven transfer, weak signal, or background." },
            renderInput("Transfer time", experiment.transfer_time, (value) => updateField("transfer_time", value)),
            renderInput("Transfer current / voltage", experiment.transfer_current, (value) => updateField("transfer_current", value)),
            renderInput("Wash program", experiment.wash_program, (value) => updateField("wash_program", value)),
            renderSelect("Detection method", experiment.detection_method, (value) => updateField("detection_method", value), [["ECL", "ECL"], ["high-sensitivity ECL", "High-sensitivity ECL"], ["fluorescent", "Fluorescent"], ["other", "Other"]])
          ),
          h(
            FieldGroup,
            { title: "Scientist Notes", copy: "Use this space for detailed run notes, observations, and anything the structured fields miss.", className: "field-group-full field-group-notes" },
            h("label", null, "Run notes", h("textarea", { value: experiment.notes, onChange: (event) => updateField("notes", event.target.value), placeholder: "What changed, what improved, what failed, and what you would do next time." }))
          )
        ),
        h(
          "div",
          { className: "stack experiment-log-column" },
          h(
            FieldGroup,
            { title: "Blotting Preferences Used", copy: "Log the membrane, transfer approach, and blocker actually chosen for this run so Butterfly can learn from repeats." },
            renderSelect("Membrane", experiment.membrane_type, (value) => updateField("membrane_type", value), [["pvdf", "PVDF"], ["nitrocellulose", "Nitrocellulose"]]),
            renderSelect("Transfer mode", experiment.transfer_mode, (value) => updateField("transfer_mode", value), [["either", "Suggest one"], ["wet", "Wet"], ["semi-dry", "Semi-dry"]]),
            renderSelect("Blocking reagent used", experiment.blocking_reagent, (value) => updateField("blocking_reagent", value), [["milk", "Milk"], ["bsa", "BSA"], ["casein", "Casein"], ["other", "Other"]])
          ),
          h(
            FieldGroup,
            { title: "Detection Conditions", copy: "Keep antibody use and exposure together so repeat runs can learn what caused signal versus haze." },
            renderInput("Primary dilution used", experiment.primary_dilution, (value) => updateField("primary_dilution", value)),
            renderInput("Secondary dilution used", experiment.secondary_dilution, (value) => updateField("secondary_dilution", value)),
            renderInput("Exposure time", experiment.exposure_time, (value) => updateField("exposure_time", value))
          ),
          h(
            FieldGroup,
            { title: "Outcome Score", copy: "Fast scoring lets Butterfly compare repeats without forcing long notes every time." },
            renderSelect("Overall outcome", experiment.overall_outcome, (value) => updateField("overall_outcome", value), [["success", "Success"], ["mixed", "Mixed"], ["failed", "Failed"]]),
            renderSelect("Signal", experiment.signal_rating, (value) => updateField("signal_rating", value), scoreOptions()),
            renderSelect("Background", experiment.background_rating, (value) => updateField("background_rating", value), scoreOptions()),
            renderSelect("Specificity", experiment.specificity_rating, (value) => updateField("specificity_rating", value), scoreOptions()),
            renderSelect("Transfer quality", experiment.transfer_rating, (value) => updateField("transfer_rating", value), scoreOptions())
          ),
          h(
            FieldGroup,
            { title: "Image Evidence", copy: "Optional uploads make troubleshooting more adaptive by adding contrast, saturation, lane variation, and background metrics.", className: "field-group-full field-group-evidence" },
            h(
              "div",
              { className: "optional-evidence-grid optional-evidence-grid-compact" },
              h(ImagePanelMini, { title: "Optional gel image", stage: "gel", analysis: analyses.gel, preview: previews.gel, onUpload, onAIInterpret, aiInterpretation: aiInterpretations.gel, aiLoadingStage }),
              h(ImagePanelMini, { title: "Optional transfer image", stage: "transfer", analysis: analyses.transfer, preview: previews.transfer, onUpload, onAIInterpret, aiInterpretation: aiInterpretations.transfer, aiLoadingStage })
            )
          )
        )
      )
    );
  }

  const AB_PAIRING_RULES = [
    {
      title: "The secondary must target the primary's host",
      body: "An anti-rabbit secondary only detects a rabbit primary. A host mismatch is the #1 cause of a totally blank blot — the detection antibody simply has nothing to bind.",
    },
    {
      title: "Validated for Western blot specifically",
      body: "An antibody validated for IHC, IF or ELISA may fail in WB, because WB needs the epitope to survive SDS denaturation. A vendor listing it for “WB” is a claim, not proof — look for an actual WB image on the datasheet.",
    },
    {
      title: "A vendor selling it ≠ it works",
      body: "Any supplier (Santa Cruz, Abcam, CST, Proteintech…) will sell an antibody to your target, but catalogue breadth isn't validation. Many widely-sold antibodies have poor specificity. Demand knockout/knockdown validation or independent citations for your species and application.",
    },
    {
      title: "Clonality changes the risk profile",
      body: "Recombinant or monoclonal antibodies give reproducible, single-epitope binding (cleaner, lot-stable). Polyclonals give stronger multi-epitope signal but more lot-to-lot variation and off-target bands.",
    },
    {
      title: "Conjugate must match your detection",
      body: "HRP secondary → ECL; AP → AP substrate; fluorophore → fluorescent imager. A mismatch here means no signal even when everything else is correct.",
    },
    {
      title: "Species reactivity and epitope region",
      body: "Confirm the antibody is validated against your sample species, and that its immunogen/epitope sits in an accessible region of your protein (see Stage 2's epitope guidance).",
    },
  ];

  function AntibodyKnowledge() {
    return h(
      "div",
      { className: "intel-apple-card ab-knowledge" },
      h("p", { className: "intel-why-kicker" }, "What a good antibody pairing needs"),
      h("p", { className: "domain-sub" }, "Before you trust a product, check it against these principles — most failed blots trace back to one of them."),
      h(
        "div",
        { className: "ab-rules-grid" },
        AB_PAIRING_RULES.map((r, i) =>
          h(
            "div",
            { className: "ab-rule", key: i },
            h("p", { className: "ab-rule-title" }, r.title),
            h("p", { className: "ab-rule-body" }, r.body)
          )
        )
      )
    );
  }

  function AntibodyLiterature({ target }) {
    const [status, setStatus] = useState(target ? "loading" : "idle");
    const [results, setResults] = useState([]);

    useEffect(() => {
      if (!target) {
        setStatus("idle");
        setResults([]);
        return undefined;
      }
      let cancelled = false;
      setStatus("loading");
      const query = encodeURIComponent(`${target} antibody western blot`);
      fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${query}&format=json&pageSize=6&resultType=lite`)
        .then((r) => {
          if (!r.ok) throw new Error("search failed");
          return r.json();
        })
        .then((data) => {
          if (cancelled) return;
          const list = ((data.resultList && data.resultList.result) || []).map((r) => ({
            title: r.title,
            authors: r.authorString,
            journal: r.journalTitle,
            year: r.pubYear,
            url: r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : r.doi ? `https://doi.org/${r.doi}` : null,
          }));
          setResults(list);
          setStatus(list.length ? "ready" : "empty");
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
      return () => {
        cancelled = true;
      };
    }, [target]);

    const pubmedSearch = target ? `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`${target} antibody western blot`)}` : "https://pubmed.ncbi.nlm.nih.gov/";

    return h(
      "div",
      { className: "intel-apple-card ab-lit" },
      h("p", { className: "intel-why-kicker" }, "Validation evidence in the literature"),
      h(
        "p",
        { className: "domain-sub" },
        target
          ? `Independent papers that used a Western blot antibody for ${target}. Citations are the strongest evidence a clone actually works — check whether your candidate (or its clone) appears here.`
          : "Add a primary target above and Butterfly will pull independent Western blot papers from the literature (via Europe PMC / PubMed)."
      ),
      status === "loading" ? h("p", { className: "ab-lit-state" }, "Searching PubMed / Europe PMC…") : null,
      status === "error" ? h("p", { className: "ab-lit-state" }, h("a", { href: pubmedSearch, target: "_blank", rel: "noreferrer" }, "Couldn't load automatically — search PubMed directly →")) : null,
      status === "empty" ? h("p", { className: "ab-lit-state" }, "No direct matches — broaden the target name, or ", h("a", { href: pubmedSearch, target: "_blank", rel: "noreferrer" }, "search PubMed →")) : null,
      status === "ready"
        ? h(
            "div",
            { className: "ab-lit-list" },
            results.map((r, i) =>
              h(
                "a",
                { className: "ab-lit-item", key: i, href: r.url || pubmedSearch, target: "_blank", rel: "noreferrer" },
                h("p", { className: "ab-lit-title" }, r.title || "Untitled record"),
                h("p", { className: "ab-lit-meta" }, [r.authors, r.journal, r.year].filter(Boolean).join(" · "))
              )
            )
          )
        : null,
      status === "ready" ? h("a", { className: "ab-lit-more", href: pubmedSearch, target: "_blank", rel: "noreferrer" }, "See all on PubMed →") : null
    );
  }

  function AntibodyCompatibilitySection({ number, experiment, updateField, antibodyCompatibility, onCheck, loading, proteinIntelligence }) {
    const target = experiment.primary_target || (proteinIntelligence && proteinIntelligence.uniprot && proteinIntelligence.uniprot.protein_name) || experiment.protein_name || "";
    return h(
      SectionCard,
      { number, title: "Antibody Compatibility", subtitle: "Stage 2 told you what to look for. Here you verify a specific primary + secondary you've chosen — and learn why a product on sale may still not work." },
      h(
        "div",
        { className: "ab-section" },
        h(AntibodyKnowledge),
        h(AntibodyLiterature, { target }),
        h(
          "div",
          { className: "ab-input-grid" },
          h(
            FieldGroup,
            { title: "Primary antibody", copy: "Add the target antibody and its product page so Butterfly can extract host species, clone hints, WB use, and manufacturer validation evidence." },
            renderInput("Primary target", experiment.primary_target, (value) => updateField("primary_target", value)),
            renderInput("Primary supplier", experiment.primary_company, (value) => updateField("primary_company", value)),
            renderInput("Primary clone / catalog hint", experiment.primary_clone, (value) => updateField("primary_clone", value)),
            renderSelect("Antibody type", experiment.primary_type, (value) => updateField("primary_type", value), [["total", "Total protein"], ["phospho", "Phospho-specific"], ["loading-control", "Loading control"], ["low-abundance", "Low abundance"]]),
            renderSelect("Primary host species", experiment.primary_host, (value) => updateField("primary_host", value), [["rabbit", "Rabbit"], ["mouse", "Mouse"], ["goat", "Goat"], ["rat", "Rat"], ["other", "Other"]]),
            renderInput("Primary isotype", experiment.primary_isotype, (value) => updateField("primary_isotype", value)),
            renderTextAreaInput("Primary antibody URL", experiment.primary_url, (value) => updateField("primary_url", value), "Example: Abcam primary antibody product page.")
          ),
          h(
            FieldGroup,
            { title: "Secondary antibody", copy: "Add the secondary so Butterfly can check it is the right anti-species, conjugate, and WB partner for the primary." },
            renderSelect("Secondary target species", experiment.secondary_target_species, (value) => updateField("secondary_target_species", value), [["rabbit", "Anti-rabbit"], ["mouse", "Anti-mouse"], ["goat", "Anti-goat"], ["rat", "Anti-rat"], ["other", "Other"]]),
            renderInput("Secondary isotype target", experiment.secondary_isotype, (value) => updateField("secondary_isotype", value)),
            renderSelect("Secondary conjugate", experiment.secondary_conjugate, (value) => updateField("secondary_conjugate", value), [["HRP", "HRP"], ["AP", "AP"], ["fluorescent", "Fluorescent"], ["unknown", "Unknown"]]),
            renderSelect("Detection", experiment.detection_method, (value) => updateField("detection_method", value), [["ECL", "ECL"], ["high-sensitivity ECL", "High-sensitivity ECL"], ["fluorescent", "Fluorescent"], ["other", "Other"]]),
            renderTextAreaInput("Secondary antibody URL", experiment.secondary_url, (value) => updateField("secondary_url", value), "Example: Cytiva / Amersham HRP-linked secondary page.")
          )
        ),
        h("div", { className: "button-row ab-check-row" }, h("button", { className: "button button-primary", type: "button", onClick: onCheck, disabled: loading }, loading ? "Checking…" : "Check this pairing")),
        antibodyCompatibility ? h(AntibodyCompatibilityResult, { result: antibodyCompatibility }) : h("div", { className: "empty-state" }, "Your compatibility result appears here. If a vendor page blocks parsing, Butterfly still uses the manual host/isotype/conjugate fields above.")
      )
    );
  }

  function AntibodyCompatibilityResult({ result }) {
    return h(
      "div",
      { className: "intel-apple-card ab-result" },
      h("h3", { className: "ab-result-title" }, `Compatibility: ${result.status}`),
      h("div", { className: `score-pill ${result.score >= 0.75 ? "score-good" : result.score >= 0.5 ? "score-warn" : "score-bad"}` }, `Confidence ${Math.round(result.score * 100)}%`),
      h("div", { className: `score-pill ${(result.url_match_score || 0) >= 0.75 ? "score-good" : (result.url_match_score || 0) >= 0.5 ? "score-warn" : "score-bad"}` }, `URL evidence match ${Math.round((result.url_match_score || 0) * 100)}%`),
      h("div", { className: `score-pill ${result.validation_score >= 0.72 ? "score-good" : result.validation_score >= 0.48 ? "score-warn" : "score-bad"}` }, `Primary validation ${Math.round((result.validation_score || 0) * 100)}% · ${result.validation_label || "limited"}`),
      result.url_match_summary ? h("p", { className: "status" }, result.url_match_summary) : null,
      result.suggested_secondary
        ? h(
            "div",
            { className: "lookup-card" },
            h("p", { className: "tiny-label" }, "Suggested Cytiva HRP secondary"),
            h("strong", null, `${result.suggested_secondary.catalog} · ${result.suggested_secondary.name}`),
            h("p", { className: "status" }, result.suggested_secondary.reason)
          )
        : null,
      result.primary?.validation_evidence
        ? h(
            "div",
            { className: "lookup-card" },
            h("p", { className: "tiny-label" }, "Manufacturer and citation evidence"),
            h("p", { className: "status" }, result.primary.validation_evidence.interpretation),
            h("ul", null, (result.primary.validation_evidence.signals || []).map((item, index) => h("li", { key: index }, item)))
          )
        : null,
      h("p", { className: "tiny-label" }, "Findings"),
      h("ul", null, (result.findings || []).map((item, index) => h("li", { key: index }, item))),
      result.warnings?.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "Warnings"), h("ul", null, result.warnings.map((item, index) => h("li", { key: index }, item)))) : null
    );
  }

  function VirtualAssistantSection({ number, analyses, comparison, troubleshootingPlan, onGenerate, loading, proteinIntelligence, onScanImage, scanLoading, scanResult, scanPreview }) {
    return h(
      SectionCard,
      {
        number,
        title: "Virtual Assistant",
        subtitle:
          "Upload a blot for Butterfly to read, or walk through the guided diagnosis. Either way you get ranked, proactive fixes — and an optional full analysis using your image and protein chemistry.",
      },
      h(
        "div",
        { className: "virtual-assistant-stack" },
        h(BlotScanner, {
          onScan: onScanImage,
          scanning: scanLoading,
          result: scanResult,
          preview: scanPreview,
          analysis: analyses && analyses.final,
        }),
        h(BranchTree, {
          proteinIntelligence,
          onRequestDetailed: onGenerate,
          detailedPlan: troubleshootingPlan,
          detailedLoading: loading,
          comparison,
        })
      )
    );
  }

  // Branching diagnostic decision tree (nodes referenced by key).
  // type "question" -> options route to the next node; type "outcome" -> ranked fixes.
  const DTREE = {
    root: {
      type: "question",
      q: "What's the main problem with your blot?",
      why: "Start with the dominant symptom — Butterfly will branch to the most likely root cause.",
      options: [
        { label: "No signal or very weak signal", next: "C1" },
        { label: "High background or haze", next: "D1" },
        { label: "Multiple or non-specific bands", next: "E1" },
        { label: "Uneven bands, smearing, or poor transfer", next: "F1" },
        { label: "Signal saturated or overexposed", next: "G" },
      ],
    },

    // --- No / weak signal branch ---
    C1: {
      type: "question",
      q: "Is your target protein present in a positive or sample control?",
      why: "Confirm the protein actually exists in the sample before chasing transfer or antibody issues.",
      options: [
        { label: "No, or I haven't checked", next: "C2" },
        { label: "Yes — it's there", next: "C3" },
      ],
    },
    C2: {
      type: "outcome",
      backend: "no signal",
      title: "Fix sample preparation & loading",
      fixes: [
        { title: "Confirm expression with a positive-control lysate", why: "Tells you whether the target is even present before changing the blot method.", impact: 0.85, effort: "Moderate" },
        { title: "Add protease inhibitors and keep samples cold", why: "Degradation during handling can remove the target entirely.", impact: 0.7, effort: "Trivial" },
        { title: "Increase load and check lysis efficiency", why: "Too little target — or poor lysis — gives no signal regardless of antibody.", impact: 0.65, effort: "Easy" },
      ],
    },
    C3: {
      type: "question",
      q: "Did the transfer work — is a Ponceau / total-protein stain even?",
      why: "If protein didn't reach the membrane, no antibody change will rescue the blot.",
      options: [
        { label: "No, or I didn't check", next: "C4" },
        { label: "Yes — transfer looks good", next: "C5" },
      ],
    },
    C4: {
      type: "outcome",
      backend: "no signal",
      title: "Optimise the transfer",
      fixes: [
        { title: "Run a Ponceau / stain-free transfer check", why: "Confirms whether protein actually transferred before you change anything else.", impact: 0.8, effort: "Easy" },
        { title: "Match membrane & method to size (PVDF + wet for large/hydrophobic)", why: "Large or hydrophobic proteins need the right membrane and wet transfer to move efficiently.", impact: 0.75, effort: "Moderate" },
        { title: "Increase transfer time and check buffer & gel %", why: "Incomplete transfer is a leading cause of weak signal.", impact: 0.65, effort: "Moderate" },
      ],
    },
    C5: {
      type: "question",
      q: "Is the primary antibody likely to work (validated, correct species)?",
      why: "With protein and transfer confirmed, the antibody is the next thing to rule out.",
      options: [
        { label: "No, or I'm unsure", next: "C6" },
        { label: "Yes — it's well validated", next: "C7" },
      ],
    },
    C6: {
      type: "outcome",
      backend: "no signal",
      title: "Address the primary antibody",
      fixes: [
        { title: "Titrate the primary up (e.g. 1:2000 → 1:1000)", why: "Low-abundance targets often just need more antibody.", impact: 0.8, effort: "Trivial" },
        { title: "Test on a validated positive-control lysate", why: "Separates a non-working antibody from a sample problem.", impact: 0.75, effort: "Moderate" },
        { title: "Check WB validation (CiteAb / BenchSci); consider a new clone", why: "A poorly-validated clone may simply not work in Western blot.", impact: 0.6, effort: "Moderate" },
      ],
    },
    C7: {
      type: "question",
      q: "Which step is most suspect — blocking, washing, or detection?",
      why: "With protein, transfer, and antibody all sound, weak signal usually traces to one of these.",
      options: [
        { label: "Blocking", next: "C8" },
        { label: "Washing", next: "C9" },
        { label: "Detection", next: "C10" },
      ],
    },
    C8: {
      type: "outcome",
      backend: "no signal",
      title: "Tune the blocking step",
      fixes: [
        { title: "Avoid over-blocking — reduce to 2–3%, ~1 h at RT", why: "Too much blocker can coat the epitope and out-compete the antibody, suppressing signal.", impact: 0.72, effort: "Trivial" },
        { title: "Test BSA vs milk (BSA for phospho targets)", why: "The wrong blocker can mask the target or add noise; BSA suits phospho-specific antibodies.", impact: 0.6, effort: "Easy" },
      ],
    },
    C9: {
      type: "outcome",
      backend: "no signal",
      title: "Adjust washing",
      fixes: [
        { title: "Soften and shorten washes for low-abundance targets", why: "Over-washing strips weakly-bound antibody and kills faint signal.", impact: 0.6, effort: "Trivial" },
        { title: "Keep the membrane wet throughout", why: "Drying causes patchy signal loss and uneven detection.", impact: 0.5, effort: "Trivial" },
      ],
    },
    C10: {
      type: "outcome",
      backend: "no signal",
      title: "Boost detection",
      fixes: [
        { title: "Switch to a high-sensitivity ECL substrate", why: "Raises detection for rare targets without overloading the gel.", impact: 0.75, effort: "Easy" },
        { title: "Increase exposure — capture short/medium/long", why: "Reveals weak signal and lets you choose the cleanest exposure.", impact: 0.6, effort: "Trivial" },
      ],
    },

    // --- High background branch ---
    D1: {
      type: "question",
      q: "Is the background uniform across the membrane, or localised?",
      why: "Uniform haze points to detection/blocking/washing; localised points to handling.",
      options: [
        { label: "Uniform haze", next: "D2" },
        { label: "Localised patches or spots", next: "D3" },
      ],
    },
    D2: {
      type: "outcome",
      backend: "high background",
      title: "Reduce uniform background",
      fixes: [
        { title: "Dilute the secondary antibody one step further", why: "Excess secondary is the most common cause of uniform background.", impact: 0.82, effort: "Trivial" },
        { title: "Increase wash volume — 4 × 8–10 min TBST", why: "Thorough washing clears unbound antibody across the whole membrane.", impact: 0.7, effort: "Trivial" },
        { title: "Don't over-block to fix it — keep blocker ~3%", why: "Piling on blocker trades background for lost signal; fix washes/secondary first.", impact: 0.6, effort: "Trivial" },
        { title: "Switch blocker (milk ↔ BSA; BSA for phospho)", why: "Blocker mismatch with the antibody biology adds background.", impact: 0.55, effort: "Easy" },
        { title: "Shorten exposure if imaging is the issue", why: "Long exposure surfaces low-level noise as apparent background.", impact: 0.5, effort: "Trivial" },
      ],
    },
    D3: {
      type: "outcome",
      backend: "high background",
      title: "Fix localised background",
      fixes: [
        { title: "Keep the membrane fully wet — avoid drying", why: "Dry spots bind antibody non-specifically and show as patches.", impact: 0.7, effort: "Trivial" },
        { title: "Remove bubbles and ensure even reagent coverage", why: "Uneven contact during incubation produces localised background.", impact: 0.6, effort: "Trivial" },
        { title: "Filter or freshly prepare antibody & blocker; clean trays", why: "Particulates and precipitated antibody cause speckled background.", impact: 0.55, effort: "Easy" },
      ],
    },

    // --- Multiple / non-specific bands branch ---
    E1: {
      type: "question",
      q: "Do the extra bands appear at the expected target size, or unexpected sizes?",
      why: "Bands at expected sizes may be real biology; unexpected sizes shift the diagnosis.",
      options: [
        { label: "At expected size (plus extra bands)", next: "E2" },
        { label: "At unexpected sizes", next: "E3" },
      ],
    },
    E2: {
      type: "outcome",
      backend: "non-specific bands",
      title: "Tighten specificity",
      fixes: [
        { title: "Lower primary concentration one step", why: "Over-concentrated primary is a common source of non-specific bands.", impact: 0.75, effort: "Trivial" },
        { title: "Run positive/negative + secondary-only controls", why: "Pinpoints whether extra bands come from the primary, secondary, or sample.", impact: 0.7, effort: "Moderate" },
        { title: "Increase wash stringency", why: "Removes loosely-bound antibody driving faint extra bands.", impact: 0.6, effort: "Trivial" },
        { title: "Test a different blocking agent", why: "Some blockers reduce non-specific interactions for a given antibody.", impact: 0.5, effort: "Easy" },
      ],
    },
    E3: {
      type: "outcome",
      backend: "non-specific bands",
      title: "Check biology & sample integrity",
      fixes: [
        { title: "Compare bands to isoforms/PTMs in UniProt before blaming the antibody", why: "Extra bands at known biological sizes may be genuine isoforms or modifications.", impact: 0.7, effort: "Easy" },
        { title: "Add protease inhibitors; shorten handling; keep cold", why: "Degradation produces lower-size bands that look non-specific.", impact: 0.65, effort: "Trivial" },
        { title: "Verify target specificity (knockdown/KO if feasible)", why: "The definitive test of whether a band is your target.", impact: 0.55, effort: "Moderate" },
      ],
    },

    // --- Uneven / smearing / poor transfer branch ---
    F1: {
      type: "question",
      q: "Does the problem start in the gel run, or after transfer?",
      why: "Where the distortion begins tells you which stage to fix.",
      options: [
        { label: "In the gel (during the run)", next: "F2" },
        { label: "After transfer", next: "F3" },
      ],
    },
    F2: {
      type: "outcome",
      backend: "smearing",
      title: "Fix gel / run conditions",
      fixes: [
        { title: "Lower the run voltage and keep the gel cool", why: "Excess voltage overheats the gel and smears/distorts bands (and causes 'smiling').", impact: 0.75, effort: "Trivial" },
        { title: "Reduce overloading and normalise sample amount", why: "Overloaded lanes smear and distort migration.", impact: 0.65, effort: "Easy" },
        { title: "Match gel % to target size; use fresh reducing buffer", why: "Wrong gel % or incomplete denaturation resolves poorly.", impact: 0.6, effort: "Easy" },
      ],
    },
    F3: {
      type: "outcome",
      backend: "smearing",
      title: "Fix the transfer",
      fixes: [
        { title: "Run a stain-free / Ponceau transfer check", why: "Confirms transfer efficiency and evenness directly.", impact: 0.75, effort: "Easy" },
        { title: "Check membrane choice, contact, bubbles, time/current", why: "Poor contact or wrong settings smear and weaken the transfer.", impact: 0.7, effort: "Moderate" },
        { title: "Keep the transfer cool and rebuild the sandwich carefully", why: "Heat and uneven pressure distort transferred bands.", impact: 0.55, effort: "Moderate" },
      ],
    },

    // --- Saturated / overexposed ---
    G: {
      type: "outcome",
      backend: "high background",
      title: "Reduce saturation / overexposure",
      fixes: [
        { title: "Shorten exposure and capture an exposure series", why: "Saturated pixels hide true band shape and background — shorter exposures recover detail.", impact: 0.85, effort: "Trivial" },
        { title: "Reduce antibody or use a weaker substrate", why: "Too much signal saturates the detector; dialling it back restores dynamic range.", impact: 0.65, effort: "Trivial" },
        { title: "Lower protein loading", why: "Less target lowers an over-strong signal into the measurable range.", impact: 0.55, effort: "Easy" },
      ],
    },
  };

  // Outcomes where hydrophobic / membrane-retention chemistry adds a transfer tip.
  const PROTEIN_AWARE_NODES = { C4: true, C6: true, C10: true, F3: true };

  function impactLabel(impact) {
    if (impact >= 0.75) return "High impact";
    if (impact >= 0.55) return "Medium impact";
    return "Worth trying";
  }

  function augmentFixes(nodeKey, fixes, proteinIntelligence) {
    const chemistry = (proteinIntelligence && proteinIntelligence.chemistry) || {};
    const membraneRisk = chemistry.membrane_retention_risk;
    const hydrophobicDomains = Number(chemistry.hydrophobic_domain_count || 0);
    const list = (fixes || []).slice();
    if (PROTEIN_AWARE_NODES[nodeKey] && (membraneRisk === "high" || hydrophobicDomains > 0)) {
      list.push({
        title: "Prefer PVDF + gentle wet transfer for this protein",
        why: "Your protein looks hydrophobic / membrane-associated, so transfer conditions matter more than antibody here.",
        impact: 0.66,
        effort: "Moderate",
      });
    }
    return list.sort((a, b) => b.impact - a.impact).slice(0, 6);
  }

  function BranchTree({ proteinIntelligence, onRequestDetailed, detailedPlan, detailedLoading, comparison }) {
    const [path, setPath] = useState(["root"]);
    const currentKey = path[path.length - 1];
    const node = DTREE[currentKey] || DTREE.root;

    function choose(nextKey) {
      setPath((prev) => [...prev, nextKey]);
    }
    function jumpTo(index) {
      setPath((prev) => prev.slice(0, index + 1));
    }
    function restart() {
      setPath(["root"]);
    }

    function stepTag(stepNode, index) {
      if (stepNode.type === "outcome") return "Conclusion";
      if (index === 0) return "Start here";
      return `Question ${index}`;
    }

    // Build the visual trail: every answered step, the choice made between them,
    // and the current step. Vertical flow — focused, with no overlapping boxes.
    const trail = [];
    path.forEach((key, index) => {
      const stepNode = DTREE[key];
      if (!stepNode) return;
      const isLast = index === path.length - 1;
      const isOutcome = stepNode.type === "outcome";
      const boxClasses = ["flow-step-box"];
      if (isOutcome) boxClasses.push("flow-step-outcome");
      if (isLast) boxClasses.push("flow-step-current");
      trail.push(
        h(
          "div",
          { className: "flow-step", key: `step-${index}` },
          h("span", { className: "flow-step-tag" }, stepTag(stepNode, index)),
          h(
            "button",
            { type: "button", className: boxClasses.join(" "), onClick: () => jumpTo(index) },
            isOutcome ? stepNode.title : stepNode.q
          )
        )
      );
      if (!isLast) {
        const childKey = path[index + 1];
        const picked = stepNode.options && stepNode.options.find((o) => o.next === childKey);
        trail.push(
          h(
            "div",
            { className: "flow-link", key: `link-${index}` },
            h("span", { className: "flow-link-chip" }, picked ? picked.label : "")
          )
        );
      }
    });

    let tail;
    if (node.type === "question") {
      tail = h(
        "div",
        { className: "flow-choose" },
        node.why ? h("p", { className: "flow-choose-why" }, node.why) : null,
        h(
          "div",
          { className: "flow-branches" },
          node.options.map((option, idx) =>
            h(
              "button",
              { key: idx, type: "button", className: "flow-branch", onClick: () => choose(option.next) },
              h("span", { className: "flow-branch-label" }, option.label),
              h("span", { className: "flow-branch-arrow", "aria-hidden": "true" }, "→")
            )
          )
        )
      );
    } else {
      const fixes = augmentFixes(currentKey, node.fixes, proteinIntelligence);
      tail = h(
        "div",
        { className: "flow-conclusion" },
        h("p", { className: "dtree-sub" }, "Ranked by how likely each is to fix your blot, based on your answers. Change one thing at a time."),
        h(
          "div",
          { className: "dtree-results" },
          fixes.map((tip, idx) =>
            h(
              "div",
              { className: "dtree-result-card", key: tip.title },
              h("span", { className: "dtree-rank" }, String(idx + 1)),
              h(
                "div",
                { className: "dtree-result-body" },
                h("strong", { className: "dtree-result-title" }, tip.title),
                h("p", { className: "dtree-result-why" }, tip.why),
                h(
                  "div",
                  { className: "dtree-meta" },
                  h(
                    "span",
                    { className: "dtree-impact" },
                    h("span", { className: "dtree-impact-track" }, h("span", { className: "dtree-impact-fill", style: { width: `${Math.round(tip.impact * 100)}%` } })),
                    h("span", { className: "dtree-impact-text" }, impactLabel(tip.impact))
                  ),
                  h("span", { className: "dtree-effort" }, `Effort: ${tip.effort}`)
                )
              )
            )
          )
        ),
        h(
          "div",
          { className: "dtree-detail" },
          detailedPlan
            ? h(
                React.Fragment,
                null,
                h("div", { className: "dtree-detail-divider" }, h("span", null, "Full analysis")),
                h(TroubleshootingResult, { plan: detailedPlan }),
                comparison
                  ? h(
                      "div",
                      { className: "comparison-grid assistant-comparison-grid" },
                      metricBlock("Similar runs", comparison.similarRuns),
                      metricBlock("Best prior membrane", comparison.bestMembrane),
                      metricBlock("Best prior blocker", comparison.bestBlocker),
                      metricBlock("Best prior transfer", comparison.bestTransfer),
                      h(
                        "div",
                        { className: "recommendation-card comparison-card-wide" },
                        h("h3", null, "What your saved runs suggest"),
                        h("ul", null, comparison.insights.map((item, index) => h("li", { key: index }, item)))
                      )
                    )
                  : null
              )
            : h(
                "p",
                { className: "dtree-detail-hint" },
                "Want the deeper dive? The full analysis adds the most-likely causes, a step-by-step plan, a next-run mini-experiment, and uses any image you've scanned."
              )
        ),
        h(
          "div",
          { className: "dtree-actions" },
          h(
            "button",
            {
              type: "button",
              className: "dtree-detail-btn",
              onClick: () => onRequestDetailed && onRequestDetailed(node.backend || "high background"),
              disabled: detailedLoading,
            },
            detailedLoading ? "Building full analysis…" : detailedPlan ? "Refresh full analysis" : "Get the full analysis"
          )
        )
      );
    }

    return h(
      "div",
      { className: "dtree" },
      h("p", { className: "dtree-kicker" }, "Guided troubleshooting"),
      h("h3", { className: "dtree-title" }, "Follow the trail to a fix"),
      h("p", { className: "dtree-sub" }, "Answer each question — your choices map out below until Butterfly reaches the most likely fixes. Tap any earlier step to change your answer."),
      h("div", { className: "flow-trail" }, trail, tail),
      h("div", { className: "flow-restart-row" }, h("button", { type: "button", className: "dtree-restart", onClick: restart }, "Start over"))
    );
  }

  function suggestedSymptomFromImage(analysis) {
    if (!analysis) return null;
    const saturation = Number(analysis.saturation_pct || 0);
    const backgroundStd = Number(analysis.background_std || 0);
    const contrast = Number(analysis.contrast || 0);
    const laneVariation = Number(analysis.lane_variation || 0);
    const asymmetry = Number(analysis.asymmetry_score || 0);
    if (saturation > 3) return "Signal saturated or overexposed";
    if (backgroundStd > 28) return "High background or haze";
    if (laneVariation > 20 || asymmetry > 18) return "Uneven bands, smearing, or poor transfer";
    if (contrast < 30) return "No signal or very weak signal";
    return null;
  }

  function BlotScanner({ onScan, scanning, result, preview, analysis }) {
    const suggestion = suggestedSymptomFromImage(analysis);
    return h(
      "div",
      { className: "dtree blot-scanner" },
      h("p", { className: "dtree-kicker" }, "Scan a blot image"),
      h("h3", { className: "dtree-title" }, "Upload your blot — Butterfly will read it"),
      h("p", { className: "dtree-sub" }, "Butterfly measures contrast, background evenness, saturation, lane variation, and asymmetry, then suggests proactive steps. Nothing is sent to any external service."),
      h(
        "label",
        { className: "blot-drop" },
        h("input", { type: "file", accept: "image/*", onChange: (event) => onScan(event.target.files && event.target.files[0]) }),
        h("span", { className: "blot-drop-text" }, scanning ? "Scanning your blot…" : "Choose or drop a blot image")
      ),
      preview ? h("img", { className: "blot-preview", src: preview, alt: "Uploaded blot" }) : null,
      suggestion
        ? h("p", { className: "blot-suggestion" }, `Based on this image, a good starting point in the guided diagnosis below is “${suggestion}”.`)
        : null,
      result ? h(AIInterpretationCard, { interpretation: result }) : null
    );
  }

  function TroubleshootingResult({ plan }) {
    return h(
      "div",
      { className: "recommendation-card comparison-card-wide" },
      h("h3", null, `Decision tree: ${capitalize(plan.symptom)}`),
      h("p", { className: "status" }, plan.summary),
      h("p", { className: "tiny-label" }, "Most likely causes"),
      h("ul", null, (plan.likely_causes || []).map((item, index) => h("li", { key: index }, item))),
      h("p", { className: "tiny-label" }, "Decision tree"),
      h("ol", { className: "steps-list" }, (plan.decision_tree || []).map((item, index) => h("li", { key: index }, item))),
      h("p", { className: "tiny-label" }, "Likely fixes to try first"),
      h("ul", null, (plan.immediate_fixes || []).map((item, index) => h("li", { key: index }, item))),
      h("p", { className: "tiny-label" }, "Next-run mini DoE"),
      h("ul", null, (plan.next_run_plan || []).map((item, index) => h("li", { key: index }, item))),
      plan.supporting_material?.length
        ? h(
            React.Fragment,
            null,
            h("p", { className: "tiny-label" }, "Supporting material used"),
            h(
              "div",
              { className: "history-stack" },
              plan.supporting_material.map((item, index) =>
                h(
                  "div",
                  { className: "lookup-card", key: `${item.title}-${index}` },
                  h("strong", null, item.title),
                  h("p", { className: "status" }, item.text)
                )
              )
            )
          )
        : null,
      h("p", { className: "tiny-label" }, "External evidence tools"),
      h(
        "div",
        { className: "history-stack" },
        (plan.evidence_tools || []).map((tool) =>
          h(
            "div",
            { className: "lookup-card", key: tool.name },
            h("strong", null, tool.name),
            h("p", { className: "status" }, tool.use),
            h("a", { href: tool.url, target: "_blank", rel: "noreferrer" }, tool.url)
          )
        )
      )
    );
  }

  function FinalIntegritySection({ number, finalAnalysis, preview, integrity, onUpload, onAIInterpret, aiInterpretation, aiLoadingStage }) {
    return h(
      SectionCard,
      { number, title: "Final Image Integrity Review", subtitle: "The final blot image is the publication-readiness checkpoint. Butterfly screens for image integrity risks such as saturation, splice-like discontinuities, asymmetry, and manipulation warning signals." },
      h(
        "div",
        { className: "upload-card" },
        h("label", null, "Upload final blot image"),
        h("input", { type: "file", accept: "image/*", onChange: (event) => onUpload("final", event.target.files && event.target.files[0]) }),
        preview ? h("img", { src: preview, className: "preview", alt: "Final blot preview" }) : null,
        h("div", { className: "button-row" }, h("button", { className: "button button-secondary", type: "button", onClick: () => onAIInterpret("final"), disabled: !preview || aiLoadingStage === "final" }, aiLoadingStage === "final" ? "Screening image..." : "Run integrity screen"))
      ),
      finalAnalysis
        ? h("div", { className: "metric-grid" }, Object.keys(metricLabels).filter((key) => finalAnalysis[key] !== undefined).map((key) => h("div", { className: "metric-card", key }, h("p", { className: "metric-label" }, metricLabels[key]), h("p", { className: "metric-value" }, key.includes("pct") ? `${finalAnalysis[key]}%` : String(finalAnalysis[key])))))
        : h("div", { className: "empty-state" }, "Upload the final blot when you want Butterfly to run its integrity screen."),
      aiInterpretation ? h(FinalIntegrityInterpretationCard, { interpretation: aiInterpretation }) : null,
      integrity ? h(RecommendationCard, { title: "Integrity review", recommendation: integrity }) : null
    );
  }

  function FinalIntegrityInterpretationCard({ interpretation }) {
    return h(
      "div",
      { className: "recommendation-card comparison-card-wide ai-card" },
      h("p", { className: "tiny-label" }, `Image integrity screen${interpretation.source === "fallback" ? " · rules-based" : ""}`),
      h("p", { className: "status" }, interpretation.summary),
      interpretation.quality_flags?.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "Integrity flags"), h("ul", null, interpretation.quality_flags.map((item, index) => h("li", { key: index }, item)))) : null,
      interpretation.band_interpretation?.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "Observed image patterns"), h("ul", null, interpretation.band_interpretation.map((item, index) => h("li", { key: index }, item)))) : null,
      interpretation.next_steps?.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "What to check before publication"), h("ul", null, interpretation.next_steps.map((item, index) => h("li", { key: index }, item)))) : null
    );
  }

  // Turn raw protein chemistry into plain-language "what this means for your
  // blot" guidance — the "understand, don't just follow" layer for Step 1.
  function proteinBlotInsights(pi) {
    const chem = (pi && pi.chemistry) || {};
    const af = (pi && pi.alphafold) || {};
    const insights = [];

    const mw = chem.molecular_weight_kda;
    if (mw !== undefined && mw !== null && mw !== "") {
      const n = Number(mw);
      let meaning;
      if (n < 15) meaning = "Small protein — use a higher-percentage gel (12–15%) and watch it doesn't run off the front.";
      else if (n <= 60) meaning = "Mid-size — resolves cleanly on a standard 10–12% gel.";
      else if (n <= 120) meaning = "On the larger side — an 8–10% gel and a longer (ideally wet) transfer help it move.";
      else meaning = "Large protein — use a low-percentage gel (6–8%) and an extended wet transfer; expect slower, harder transfer.";
      insights.push({ label: "Molecular weight", value: `${Math.round(n)} kDa`, meaning });
    }

    const pIVal = chem.theoretical_pI;
    if (pIVal !== undefined && pIVal !== null && pIVal !== "") {
      const n = Number(pIVal);
      let meaning;
      if (n < 5.5) meaning = "Acidic — net-negative at neutral pH, so it usually transfers well in standard buffers.";
      else if (n <= 8) meaning = "Near-neutral charge — standard transfer and blocking conditions are a good starting point.";
      else meaning = "Basic — basic proteins can transfer poorly at standard pH; consider transfer-buffer pH or a longer transfer.";
      insights.push({ label: "Isoelectric point (pI)", value: n, meaning });
    }

    const memRisk = chem.membrane_retention_risk;
    const hydDomains = Number(chem.hydrophobic_domain_count || 0);
    if (memRisk || hydDomains) {
      const hydrophobic = memRisk === "high" || hydDomains > 0;
      insights.push({
        label: "Hydrophobicity",
        value: memRisk ? `${memRisk} retention` : `${hydDomains} domain(s)`,
        meaning: hydrophobic
          ? "Hydrophobic / membrane-associated — prefer PVDF + gentle wet transfer, allow longer blocking, and don't over-boil (it can aggregate)."
          : "Largely soluble — standard transfer and blocking should work well.",
      });
    }

    const agg = chem.aggregation_risk;
    if (agg) {
      insights.push({
        label: "Aggregation risk",
        value: agg,
        meaning: agg === "high" || agg === "moderate"
          ? "Aggregation-prone — keep lysate cold, use fresh reducing buffer, and avoid overheating; high-MW smears are a risk."
          : "Low aggregation risk — standard sample prep should be fine.",
      });
    }

    if (af && af.available) {
      const plddt = Number(af.mean_plddt || 0);
      insights.push({
        label: "Structure confidence",
        value: `pLDDT ${af.mean_plddt}`,
        meaning: plddt >= 70
          ? "High-confidence predicted structure — accessibility and domain cues are reliable."
          : "Lower-confidence or possibly disordered — treat structural cues as rough guidance.",
      });
    }

    const cleavage = Number(chem.cleavage_site_count || 0);
    if (cleavage > 0) {
      insights.push({
        label: "Processing sites",
        value: `${cleavage}`,
        meaning: "Has cleavage/processing sites — you may see processed bands below the full-length size, which can look like extra bands.",
      });
    }

    return insights;
  }

  const FEATURE_COLORS = {
    TRANSMEM: "#d98b19",
    INTRAMEM: "#e0a82e",
    SIGNAL: "#c79769",
    TRANSIT: "#c79769",
    PROPEP: "#b08968",
    PEPTIDE: "#b9c7bf",
    CHAIN: "#aebfb4",
    DOMAIN: "#3f7fbf",
    REGION: "#8a9aa8",
    REPEAT: "#7b6cc4",
    COILED: "#5aa0a0",
    ZN_FING: "#b5651d",
    DNA_BIND: "#6b7fd7",
    TOPO_DOM: "#cbb88a",
    MOTIF: "#cc7a8b",
  };

  function featureLabel(type) {
    const map = {
      TRANSMEM: "Transmembrane",
      INTRAMEM: "Intramembrane",
      SIGNAL: "Signal peptide",
      TRANSIT: "Transit peptide",
      PROPEP: "Propeptide",
      PEPTIDE: "Peptide",
      CHAIN: "Mature chain",
      DOMAIN: "Domain",
      REGION: "Region",
      REPEAT: "Repeat",
      COILED: "Coiled-coil",
      ZN_FING: "Zinc finger",
      DNA_BIND: "DNA-binding",
      TOPO_DOM: "Topological domain",
      MOTIF: "Motif",
    };
    return map[type] || type;
  }

  function featureColor(type) {
    return FEATURE_COLORS[type] || "#7f8c99";
  }

  // Interactive 3D AlphaFold structure. The 3Dmol library is loaded on demand
  // and every interaction is guarded so a failure can never break the page.
  function StructureViewer({ alphafold, accession, highlight }) {
    const ref = useRef(null);
    const viewerObj = useRef(null);
    const [status, setStatus] = useState("loading");
    const pdbUrl = alphafold && alphafold.pdb_url;

    function applyStyle(viewer, hl) {
      viewer.setStyle({}, { cartoon: { colorscheme: { prop: "b", gradient: "roygb", min: 50, max: 90 }, opacity: hl ? 0.55 : 1 } });
      if (hl && hl.begin && hl.end) {
        viewer.setStyle({ resi: `${hl.begin}-${hl.end}` }, { cartoon: { color: "0xc026d3", opacity: 1 } });
      }
      viewer.render();
    }

    useEffect(() => {
      if (!pdbUrl) {
        setStatus("error");
        return undefined;
      }
      let cancelled = false;
      setStatus("loading");
      viewerObj.current = null;

      function render3D() {
        try {
          if (cancelled) return;
          if (!window.$3Dmol || !ref.current) {
            setStatus("error");
            return;
          }
          ref.current.innerHTML = "";
          const viewer = window.$3Dmol.createViewer(ref.current, { backgroundColor: "white" });
          fetch(pdbUrl)
            .then((response) => {
              if (!response.ok) throw new Error("structure fetch failed");
              return response.text();
            })
            .then((text) => {
              if (cancelled) return;
              viewer.addModel(text, "pdb");
              viewer.setStyle({}, { cartoon: { colorscheme: { prop: "b", gradient: "roygb", min: 50, max: 90 } } });
              viewer.zoomTo();
              viewer.render();
              viewerObj.current = viewer;
              setStatus("ready");
            })
            .catch(() => {
              if (!cancelled) setStatus("error");
            });
        } catch (err) {
          if (!cancelled) setStatus("error");
        }
      }

      if (window.$3Dmol) {
        render3D();
        return () => {
          cancelled = true;
        };
      }

      let script = document.getElementById("dmol-lib");
      if (!script) {
        script = document.createElement("script");
        script.id = "dmol-lib";
        script.src = "https://3Dmol.org/build/3Dmol-min.js";
        document.head.appendChild(script);
      }
      const onLoad = () => render3D();
      const onError = () => {
        if (!cancelled) setStatus("error");
      };
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
      return () => {
        cancelled = true;
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
      };
    }, [pdbUrl]);

    // Re-colour to highlight the selected domain on the fold.
    useEffect(() => {
      if (status !== "ready" || !viewerObj.current) return;
      try {
        applyStyle(viewerObj.current, highlight);
      } catch (err) {
        /* viewer not ready / disposed — ignore */
      }
    }, [highlight, status]);

    if (!pdbUrl) {
      return h(
        "div",
        { className: "intel-apple-card struct-card" },
        h("p", { className: "intel-why-kicker" }, "3D structure"),
        h("p", { className: "struct-note" }, "No AlphaFold model was resolved for this entry, so a 3D fold isn't available.")
      );
    }

    return h(
      "div",
      { className: "intel-apple-card struct-card" },
      h(
        "div",
        { className: "struct-head" },
        h("p", { className: "intel-why-kicker" }, "3D structure · AlphaFold"),
        alphafold.confidence_label
          ? h("span", { className: `struct-conf struct-conf-${alphafold.confidence_label}` }, `${alphafold.confidence_label} confidence · pLDDT ${alphafold.mean_plddt}`)
          : null
      ),
      h(
        "div",
        { className: "struct-viewer-wrap" },
        h("div", { className: "struct-viewer", ref }),
        status !== "ready"
          ? h(
              "div",
              { className: "struct-overlay" },
              status === "loading"
                ? "Loading 3D model…"
                : h(
                    React.Fragment,
                    null,
                    "3D viewer unavailable. ",
                    accession
                      ? h("a", { href: `https://alphafold.ebi.ac.uk/entry/${accession}`, target: "_blank", rel: "noreferrer" }, "Open on AlphaFold")
                      : null
                  )
            )
          : null
      ),
      h("p", { className: "struct-legend-note" }, "Drag to rotate · scroll to zoom. Cartoon coloured by model confidence (pLDDT): warmer = lower, cooler = higher.")
    );
  }

  // Data-driven 1D domain / topology map built from UniProt/EBI positional
  // features — N-terminus on the left, C-terminus on the right.
  function DomainMap({ proteinIntelligence, selected, onSelect }) {
    const identity = proteinIntelligence.uniprot || {};
    const chemistry = proteinIntelligence.chemistry || {};
    const length = Number(identity.sequence_length || chemistry.sequence_length || 0);
    const raw = (proteinIntelligence.ebi_features && proteinIntelligence.ebi_features.examples) || [];

    const features = raw
      .map((f) => ({ type: f.type, begin: Number(f.begin), end: Number(f.end), description: f.description || "" }))
      .filter((f) => Number.isFinite(f.begin) && Number.isFinite(f.end) && f.begin >= 1 && f.end >= f.begin && (!length || f.end <= length));

    if (!length) return null;

    const isSelected = (f) => selected && selected.begin === f.begin && selected.end === f.end && selected.type === f.type;
    const toggle = (f) => {
      if (!onSelect) return;
      onSelect(isSelected(f) ? null : f);
    };

    // One lane per feature type for a clean, non-overlapping track view.
    const types = [];
    features.forEach((f) => {
      if (types.indexOf(f.type) === -1) types.push(f.type);
    });

    const W = 960;
    const leftPad = 140;
    const rightPad = 28;
    const topPad = 34;
    const laneH = 26;
    const laneGap = 12;
    const innerW = W - leftPad - rightPad;
    const H = topPad + Math.max(types.length, 1) * (laneH + laneGap) + 16;
    const xOf = (res) => leftPad + ((res - 1) / Math.max(1, length - 1)) * innerW;

    const ticks = [1, Math.round(length * 0.25), Math.round(length * 0.5), Math.round(length * 0.75), length];

    const svgChildren = [];
    ticks.forEach((t, i) => {
      svgChildren.push(h("line", { key: `tl-${i}`, x1: xOf(t), y1: topPad - 9, x2: xOf(t), y2: topPad - 4, stroke: "rgba(0,0,0,0.25)" }));
      svgChildren.push(h("text", { key: `tt-${i}`, x: xOf(t), y: topPad - 13, textAnchor: "middle", className: "domain-tick" }, String(t)));
    });
    svgChildren.push(h("text", { key: "nterm", x: leftPad, y: topPad + 6, textAnchor: "start", className: "domain-term" }, "N"));
    svgChildren.push(h("text", { key: "cterm", x: leftPad + innerW, y: topPad + 6, textAnchor: "end", className: "domain-term" }, "C"));

    types.forEach((type, laneIdx) => {
      const laneY = topPad + 12 + laneIdx * (laneH + laneGap);
      svgChildren.push(h("text", { key: `lab-${laneIdx}`, x: leftPad - 12, y: laneY + laneH / 2 + 4, textAnchor: "end", className: "domain-lane-label" }, featureLabel(type)));
      svgChildren.push(h("rect", { key: `base-${laneIdx}`, x: leftPad, y: laneY + laneH / 2 - 1, width: innerW, height: 2, fill: "rgba(217,139,25,0.12)" }));
      features
        .filter((f) => f.type === type)
        .forEach((f, i) => {
          const x1 = xOf(f.begin);
          const x2 = xOf(f.end);
          const segW = Math.max(4, x2 - x1);
          const sel = isSelected(f);
          svgChildren.push(
            h(
              "g",
              { key: `seg-${laneIdx}-${i}`, className: "domain-seg", onClick: () => toggle(f), style: { cursor: "pointer" } },
              h("title", null, `${featureLabel(f.type)} · ${f.begin}–${f.end}${f.description ? `: ${f.description}` : ""}`),
              h("rect", {
                x: x1,
                y: laneY,
                width: segW,
                height: laneH,
                rx: 5,
                fill: featureColor(type),
                opacity: selected && !sel ? 0.4 : 0.92,
                stroke: sel ? "#d98b19" : "none",
                strokeWidth: sel ? 2.5 : 0,
              })
            )
          );
        });
    });

    return h(
      "div",
      { className: "intel-apple-card domain-card" },
      h("p", { className: "intel-why-kicker" }, "Sequence & domain map"),
      h("p", { className: "domain-sub" }, `${length} residues · N-terminus (left) → C-terminus (right) · click a feature to highlight it on the 3D fold below`),
      features.length
        ? h(
            "div",
            { className: "domain-map-scroll" },
            h("svg", { viewBox: `0 0 ${W} ${H}`, className: "domain-map-svg", preserveAspectRatio: "xMidYMid meet" }, svgChildren)
          )
        : h("p", { className: "domain-empty" }, "No positional domain or topology features were returned for this entry — the chain length is shown above for context."),
      selected
        ? h(
            "div",
            { className: "domain-readout" },
            h("span", { className: "domain-readout-dot", style: { background: featureColor(selected.type) } }),
            h("strong", null, `${featureLabel(selected.type)} · residues ${selected.begin}–${selected.end}`),
            selected.description ? h("span", { className: "domain-readout-desc" }, ` — ${selected.description}`) : null
          )
        : null
    );
  }

  // "Where will my band run?" — predicted band on a standard MW ladder, with
  // zones for likely processed (lower) and aggregated/PTM (higher) species.
  function ExpectedBand({ proteinIntelligence }) {
    const chem = proteinIntelligence.chemistry || {};
    const counts = (proteinIntelligence.ebi_features && proteinIntelligence.ebi_features.counts) || {};
    const mw = Number(chem.molecular_weight_kda || 0);
    if (!mw) return null;

    const ladder = [250, 150, 100, 75, 50, 37, 25, 20, 15, 10];
    const topPad = 26;
    const gelH = 300;
    const laneX = 116;
    const laneW = 128;
    const minLog = Math.log10(10);
    const maxLog = Math.log10(250);
    const clamp = (v) => Math.max(10, Math.min(250, v));
    const yOf = (m) => topPad + (1 - (Math.log10(clamp(m)) - minLog) / (maxLog - minLog)) * gelH;
    const H = topPad + gelH + 26;

    const processed = Number(chem.cleavage_site_count || 0) > 0 || Number(counts.SIGNAL || 0) > 0 || Number(counts.PROPEP || 0) > 0;
    const aggregation = chem.aggregation_risk === "moderate" || chem.aggregation_risk === "high";
    const glyco = Number(chem.glycosylation_sites || counts.CARBOHYD || 0);
    const ty = yOf(mw);
    const apparentY = yOf(mw * 1.4); // glycosylated forms commonly run higher

    const children = [];
    children.push(h("text", { key: "axis", x: laneX - 12, y: topPad - 9, textAnchor: "end", className: "gel-axis" }, "kDa"));
    children.push(h("rect", { key: "lane", x: laneX, y: topPad, width: laneW, height: gelH, rx: 6, fill: "#f3f0e6", stroke: "rgba(0,0,0,0.08)" }));
    if (aggregation) {
      children.push(h("rect", { key: "agg", x: laneX, y: topPad, width: laneW, height: Math.max(0, ty - topPad), fill: "rgba(255,199,44,0.14)" }));
    }
    if (processed) {
      children.push(h("rect", { key: "proc", x: laneX, y: ty, width: laneW, height: Math.max(0, topPad + gelH - ty), fill: "rgba(217,139,25,0.08)" }));
    }
    ladder.forEach((m, i) => {
      const y = yOf(m);
      children.push(h("line", { key: `lt-${i}`, x1: laneX - 8, y1: y, x2: laneX, y2: y, stroke: "rgba(0,0,0,0.3)" }));
      children.push(h("text", { key: `ll-${i}`, x: laneX - 12, y: y + 4, textAnchor: "end", className: "gel-tick" }, String(m)));
      children.push(h("line", { key: `lg-${i}`, x1: laneX, y1: y, x2: laneX + laneW, y2: y, stroke: "rgba(0,0,0,0.06)" }));
    });
    if (glyco > 0 && apparentY < ty - 6) {
      children.push(h("rect", { key: "appband", x: laneX + 8, y: apparentY - 4, width: laneW - 16, height: 8, rx: 3, fill: "none", stroke: "#d98b19", strokeWidth: 2, strokeDasharray: "5 4" }));
      children.push(h("text", { key: "applabel", x: laneX + laneW + 18, y: apparentY + 4, textAnchor: "start", className: "gel-app-label" }, "apparent (glycosylated)"));
    }
    children.push(h("rect", { key: "band", x: laneX + 8, y: ty - 5, width: laneW - 16, height: 10, rx: 3, fill: "#d98b19" }));
    children.push(h("line", { key: "blead", x1: laneX + laneW, y1: ty, x2: laneX + laneW + 14, y2: ty, stroke: "#d98b19", strokeWidth: 2 }));
    children.push(h("text", { key: "blabel", x: laneX + laneW + 18, y: ty + 4, textAnchor: "start", className: "gel-band-label" }, `~${Math.round(mw)} kDa · your target`));

    return h(
      "div",
      { className: "intel-apple-card gel-card" },
      h("p", { className: "intel-why-kicker" }, "Where your band should run"),
      h("p", { className: "domain-sub" }, `Predicted main band ≈ ${Math.round(mw)} kDa against a standard protein ladder.`),
      h(
        "div",
        { className: "gel-scroll" },
        h("svg", { viewBox: `0 0 360 ${H}`, className: "gel-svg", preserveAspectRatio: "xMidYMid meet" }, children)
      ),
      processed || aggregation || glyco > 0
        ? h(
            "ul",
            { className: "gel-notes" },
            glyco > 0 ? h("li", { key: "g" }, `${glyco} N-glycosylation site(s) — the protein often runs HIGHER than the predicted ${Math.round(mw)} kDa (a fuzzier, shifted band).`) : null,
            processed ? h("li", { key: "p" }, "Faint lower bands are plausible — this protein has signal/cleavage/processing sites (processed or degraded forms).") : null,
            aggregation ? h("li", { key: "a" }, "Higher-MW bands or smears are plausible — aggregation/PTM risk is elevated; keep samples cold and fully denatured.") : null
          )
        : h("p", { className: "gel-notes-clean" }, "No strong processing or aggregation cues — expect a clean single band near the predicted size.")
    );
  }

  // Antibody epitope guidance — accessible (non-buried, non-cleaved) regions
  // from real topology features, so users avoid raising antibodies to TM or
  // signal/propeptide stretches.
  function EpitopeGuidance({ proteinIntelligence }) {
    const identity = proteinIntelligence.uniprot || {};
    const chem = proteinIntelligence.chemistry || {};
    const length = Number(identity.sequence_length || chem.sequence_length || 0);
    const raw = (proteinIntelligence.ebi_features && proteinIntelligence.ebi_features.examples) || [];
    if (!length) return null;

    const avoidTypes = { TRANSMEM: 1, INTRAMEM: 1, SIGNAL: 1, PROPEP: 1, TRANSIT: 1 };
    const avoid = raw
      .map((f) => ({ type: f.type, begin: Number(f.begin), end: Number(f.end) }))
      .filter((f) => avoidTypes[f.type] && Number.isFinite(f.begin) && Number.isFinite(f.end) && f.end >= f.begin)
      .sort((a, b) => a.begin - b.begin);

    const accessible = [];
    let cursor = 1;
    avoid.forEach((f) => {
      if (f.begin > cursor) accessible.push({ begin: cursor, end: f.begin - 1 });
      cursor = Math.max(cursor, f.end + 1);
    });
    if (cursor <= length) accessible.push({ begin: cursor, end: length });
    const sized = accessible.map((s) => ({ begin: s.begin, end: s.end, len: s.end - s.begin + 1 })).sort((a, b) => b.len - a.len);

    const af = proteinIntelligence.alphafold || {};

    return h(
      "div",
      { className: "intel-apple-card" },
      h("p", { className: "intel-why-kicker" }, "Antibody epitope guidance"),
      avoid.length
        ? h("p", { className: "domain-sub" }, "Raise or choose antibodies against accessible regions; avoid buried (transmembrane) or cleaved (signal/propeptide) stretches.")
        : h("p", { className: "domain-sub" }, "No transmembrane or cleaved regions detected — most of the chain is accessible for antibody binding."),
      sized.length
        ? h(
            "div",
            { className: "epi-list" },
            sized.slice(0, 4).map((s, i) =>
              h(
                "div",
                { className: i === 0 ? "epi-item epi-item-top" : "epi-item", key: i },
                h("span", { className: "epi-range" }, `Residues ${s.begin}–${s.end}`),
                h("span", { className: "epi-len" }, `${s.len} aa`),
                i === 0 ? h("span", { className: "epi-tag" }, "Best candidate") : null
              )
            )
          )
        : null,
      avoid.length
        ? h("p", { className: "epi-avoid" }, `Avoid: ${avoid.map((f) => `${featureLabel(f.type)} ${f.begin}–${f.end}`).join(" · ")}`)
        : null,
      af.confidence_label === "cautious"
        ? h("p", { className: "epi-note" }, "Structure confidence is low, so treat these boundaries as approximate.")
        : null
    );
  }

  // Copy / export helpers for the lab notebook.
  function CopyTools({ proteinIntelligence }) {
    const [copied, setCopied] = useState("");
    const chem = proteinIntelligence.chemistry || {};
    const identity = proteinIntelligence.uniprot || {};
    const seq = chem.sequence || "";
    const accession = proteinIntelligence.resolved_accession || identity.accession || "protein";
    const name = identity.protein_name || "protein";

    function copyText(text, tag) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            () => {
              setCopied(tag);
              setTimeout(() => setCopied(""), 1500);
            },
            () => {}
          );
        }
      } catch (err) {
        /* clipboard unavailable — ignore */
      }
    }

    function copyFasta() {
      if (!seq) return;
      const header = `>${accession} ${name}`.trim();
      const wrapped = seq.replace(/(.{60})/g, "$1\n");
      copyText(`${header}\n${wrapped}\n`, "fasta");
    }

    function copySummary() {
      const lines = [
        `Protein: ${name}`,
        `Accession: ${accession}`,
        `Length: ${chem.sequence_length || "?"} aa`,
        `Predicted MW: ${chem.molecular_weight_kda || "?"} kDa`,
        `Predicted pI: ${chem.theoretical_pI || "?"}`,
        `Aggregation risk: ${chem.aggregation_risk || "n/a"}`,
        `Membrane retention: ${chem.membrane_retention_risk || "n/a"}`,
        `Glycosylation sites: ${chem.glycosylation_sites || 0}`,
      ];
      copyText(lines.join("\n"), "summary");
    }

    return h(
      "div",
      { className: "intel-tools" },
      seq ? h("button", { type: "button", className: "intel-tool-btn", onClick: copyFasta }, copied === "fasta" ? "FASTA copied ✓" : "Copy FASTA") : null,
      h("button", { type: "button", className: "intel-tool-btn", onClick: copySummary }, copied === "summary" ? "Summary copied ✓" : "Copy summary")
    );
  }

  // Combines the interactive domain map (top, full width), the 3D fold, and the
  // predicted band. Selecting a feature on the map highlights it on the structure.
  function StructurePanel({ proteinIntelligence }) {
    const [selected, setSelected] = useState(null);
    const af = proteinIntelligence.alphafold || {};
    return h(
      "div",
      { className: "intel-structure-stack" },
      h(DomainMap, { proteinIntelligence, selected, onSelect: setSelected }),
      h(
        "div",
        { className: "intel-fold-row" },
        h(StructureViewer, { alphafold: af, accession: proteinIntelligence.resolved_accession, highlight: selected }),
        h(ExpectedBand, { proteinIntelligence })
      ),
      h(EpitopeGuidance, { proteinIntelligence })
    );
  }

  function ProteinIntelligencePane({ proteinIntelligence }) {
    const identity = proteinIntelligence.uniprot || {};
    const chemistry = proteinIntelligence.chemistry || {};
    const counts = proteinIntelligence.ebi_features?.counts || {};
    const examples = proteinIntelligence.ebi_features?.examples || [];
    const bandRisks = proteinIntelligence.band_risks || [];
    const featureTags = [
      counts.TRANSMEM ? `TM ${counts.TRANSMEM}` : null,
      chemistry.hydrophobic_domain_count !== undefined ? `Hydrophobic domains ${chemistry.hydrophobic_domain_count}` : null,
      chemistry.longest_hydrophobic_run !== undefined ? `Longest hydrophobic run ${chemistry.longest_hydrophobic_run}` : null,
      chemistry.cleavage_site_count !== undefined ? `Cleavage/processing ${chemistry.cleavage_site_count}` : null,
      counts.SIGNAL ? `Signal ${counts.SIGNAL}` : null,
      counts.DOMAIN ? `Domains ${counts.DOMAIN}` : null,
      counts.DNA_BIND ? `DNA bind ${counts.DNA_BIND}` : null,
    ].filter(Boolean);

    const structureLines = [
      proteinIntelligence.alphafold?.available ? `AlphaFold confidence: ${proteinIntelligence.alphafold.mean_plddt} (${proteinIntelligence.alphafold.confidence_label})` : "No AlphaFold prediction was resolved yet.",
      chemistry.aggregation_risk ? `Folding / aggregation risk: ${chemistry.aggregation_risk}` : null,
      chemistry.membrane_retention_risk ? `Membrane-association tendency: ${chemistry.membrane_retention_risk}` : null,
    ].filter(Boolean);

    const identityLines = [
      identity.protein_name || "Unknown target",
      identity.genes?.length ? `Gene: ${identity.genes.join(", ")}` : null,
      identity.organism ? `Organism: ${identity.organism}` : null,
      identity.reviewed ? `Reviewed status: ${identity.reviewed}` : null,
    ].filter(Boolean);

    const insights = proteinBlotInsights(proteinIntelligence);
    const af = proteinIntelligence.alphafold || {};
    const seqLength = Number((proteinIntelligence.uniprot || {}).sequence_length || chemistry.sequence_length || 0);

    return h(
      "div",
      { className: "intel-results" },
      h(CopyTools, { proteinIntelligence }),
      af.available || seqLength
        ? h(StructurePanel, { proteinIntelligence })
        : null,
      h("div", { className: "metric-grid" }, metricBlock("Accession", proteinIntelligence.resolved_accession || "Not resolved"), metricBlock("Predicted pI", chemistry.theoretical_pI ?? "n/a"), metricBlock("MW (kDa)", chemistry.molecular_weight_kda ?? "n/a"), metricBlock("AlphaFold pLDDT", proteinIntelligence.alphafold?.mean_plddt ?? "n/a"), metricBlock("Membrane retention risk", chemistry.membrane_retention_risk ?? "n/a"), metricBlock("Aggregation risk", chemistry.aggregation_risk ?? "n/a")),
      insights.length
        ? h(
            "div",
            { className: "intel-why" },
            h("p", { className: "intel-why-kicker" }, "What this means for your blot"),
            h(
              "div",
              { className: "intel-why-grid" },
              insights.map((item, index) =>
                h(
                  "div",
                  { className: "intel-why-card", key: index },
                  h(
                    "div",
                    { className: "intel-why-head" },
                    h("span", { className: "intel-why-label" }, item.label),
                    h("span", { className: "intel-why-value" }, String(item.value))
                  ),
                  h("p", { className: "intel-why-text" }, item.meaning)
                )
              )
            )
          )
        : null,
      h(
        "div",
        { className: "protein-evidence-grid" },
        h(
          "div",
          { className: "lookup-card evidence-card" },
          h("p", { className: "tiny-label" }, "Identity"),
          h("strong", null, identity.protein_name || experimentFallbackName(proteinIntelligence)),
          h("ul", null, identityLines.map((item, index) => h("li", { key: index }, item))),
          h("div", { className: "tag-row" }, tag(`Seq length ${identity.sequence_length || chemistry.sequence_length || "n/a"}`), tag(identity.accession || "No accession"), tag(identity.reviewed || "Sequence-derived"))
        ),
        h(
          "div",
          { className: "lookup-card evidence-card" },
          h("p", { className: "tiny-label" }, "Chemistry"),
          h("div", { className: "tag-row" }, tag(`Charge / pI ${chemistry.theoretical_pI ?? "n/a"}`), tag(`Hydrophobicity ${chemistry.hydrophobic_fraction ?? "n/a"}`), tag(`Solubility risk ${chemistry.aggregation_risk || "n/a"}`)),
          h("ul", null, (proteinIntelligence.buffer_recommendations || []).slice(0, 4).map((item, index) => h("li", { key: index }, item)))
        ),
        h(
          "div",
          { className: "lookup-card evidence-card" },
          h("p", { className: "tiny-label" }, "Structure"),
          h("ul", null, structureLines.map((item, index) => h("li", { key: index }, item))),
          proteinIntelligence.alphafold?.pdb_url ? h("p", { className: "status" }, "AlphaFold structural model is available for deeper accessibility interpretation.") : null,
          proteinIntelligence.resolved_accession
            ? h(
                "p",
                { className: "status" },
                h("a", { href: `https://www.alphafold.ebi.ac.uk/entry/${proteinIntelligence.resolved_accession}`, target: "_blank", rel: "noreferrer" }, "View this protein on AlphaFold")
              )
            : null
        ),
        h(
          "div",
          { className: "lookup-card evidence-card" },
          h("p", { className: "tiny-label" }, "Features"),
          h("div", { className: "tag-row" }, featureTags.map((value) => tag(value))),
          examples.length ? h("ul", null, examples.slice(0, 5).map((item, index) => h("li", { key: index }, `${item.type} ${item.begin || "?"}-${item.end || "?"} ${item.description || ""}`.trim()))) : h("p", { className: "status" }, "Feature-level annotations will appear here when available.")
        ),
        h(
          "div",
          { className: "lookup-card evidence-card evidence-card-wide" },
          h("p", { className: "tiny-label" }, "Blot Meaning"),
          h("ul", null, (proteinIntelligence.predictions || []).map((item, index) => h("li", { key: index }, item))),
          bandRisks.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "Likely confounders"), h("ul", null, bandRisks.map((item, index) => h("li", { key: index }, `${item.title}: ${item.detail}`)))) : null
        )
      )
    );
  }

  function ProteinFirstPlanCard({ plan, proteinIntelligence, recommendations, experiment }) {
    const workflowCards = buildPredictiveWorkflowCards(proteinIntelligence, experiment, recommendations, plan);
    return h(
      "div",
      { className: "recommendation-card comparison-card-wide" },
      h("h3", null, "Protein-led predictive model"),
      h("p", { className: "status" }, plan.summary),
      h(
        "div",
        { className: "predictive-workflow-grid" },
        workflowCards.map((card) =>
          h(
            "div",
            { className: "lookup-card predictive-workflow-card", key: card.title },
            h("p", { className: "tiny-label" }, card.title),
            h("strong", null, `Recommended: ${card.recommended}`),
            h("p", { className: "tiny-label" }, "Because"),
            h("ul", null, card.because.map((item, index) => h("li", { key: index }, item))),
            h("p", { className: "tiny-label" }, "Watch"),
            h("ul", null, card.watch.map((item, index) => h("li", { key: index }, item)))
          )
        )
      )
    );
  }

  function RecommendationCard({ title, recommendation }) {
    const scoreClass = recommendation.score >= 0.75 ? "score-good" : recommendation.score >= 0.5 ? "score-warn" : "score-bad";
    return h("div", { className: "recommendation-card" }, h("h3", null, title), h("p", { className: "status mono-copy" }, recommendation.summary), h("div", { className: `score-pill ${scoreClass}` }, `Confidence ${Math.round(recommendation.score * 100)}%`), h("p", { className: "tiny-label" }, "Why Butterfly thinks this"), h("ul", null, recommendation.rationale.map((item, index) => h("li", { key: index }, item))), h("p", { className: "tiny-label" }, "Next actions"), h("ul", null, recommendation.actions.map((item, index) => h("li", { key: index }, item))));
  }

  function ImagePanelMini({ title, stage, analysis, preview, onUpload, onAIInterpret, aiInterpretation, aiLoadingStage }) {
    return h(
      "div",
      { className: "upload-card" },
      h("label", null, title),
      h("input", { type: "file", accept: "image/*", onChange: (event) => onUpload(stage, event.target.files && event.target.files[0]) }),
      preview ? h("img", { src: preview, className: "preview preview-mini", alt: `${stage} preview` }) : null,
      analysis ? h("div", { className: "tiny-label" }, `Contrast ${analysis.contrast} • Saturation ${analysis.saturation_pct}%`) : h("div", { className: "tiny-label" }, "Optional supporting evidence")
    );
  }

  function AIInterpretationCard({ interpretation }) {
    return h(
      "div",
      { className: "ai-scan-card" },
      h("p", { className: "tiny-label" }, `Image read${interpretation.source === "fallback" ? " · Butterfly scan" : interpretation.model ? ` · ${interpretation.model}` : ""}`),
      h("p", { className: "ai-scan-summary" }, interpretation.summary),
      interpretation.quality_flags?.length
        ? h(
            "div",
            { className: "ai-flag-row" },
            interpretation.quality_flags.map((item, index) => h("span", { className: "ai-flag", key: index }, item))
          )
        : null,
      interpretation.possible_causes?.length
        ? h(React.Fragment, null, h("p", { className: "ai-scan-label" }, "Likely causes"), h("ul", { className: "ai-scan-list" }, interpretation.possible_causes.slice(0, 4).map((item, index) => h("li", { key: index }, item))))
        : null,
      interpretation.next_steps?.length
        ? h(React.Fragment, null, h("p", { className: "ai-scan-label" }, "Do next"), h("ul", { className: "ai-scan-list" }, interpretation.next_steps.slice(0, 4).map((item, index) => h("li", { key: index }, item))))
        : null
    );
  }

  function SidebarPanel({ history, selectedId, onLoad }) {
    return h(
      "aside",
      { className: "stack" },
      h(
        SectionCard,
        { number: "07", title: "Experiment History", subtitle: "Saved runs become Butterfly’s internal evidence base." },
        history.length
          ? h("div", { className: "history-stack" }, history.map((item) => h("div", { className: "history-item", key: item.id }, h("h3", null, item.title), h("div", { className: "history-meta mono-copy" }, `Experiment #${item.id} • updated ${formatDate(item.updated_at)}`), h("div", { className: "tag-row" }, buildTags(item.payload).map((itemTag) => h("span", { className: "tag", key: itemTag }, itemTag))), h("div", { className: "button-row" }, h("button", { className: item.id === selectedId ? "button button-secondary" : "button button-ghost", type: "button", onClick: () => onLoad(item) }, item.id === selectedId ? "Loaded" : "Load")))))
          : h("div", { className: "empty-state" }, "No saved experiments yet.")
      )
    );
  }

  function SectionCard({ number, title, subtitle, children }) {
    return h("section", { className: "panel panel-active" }, h("div", { className: "panel-header" }, h("div", { className: "panel-index" }, number || title.charAt(0)), h("div", null, h("h2", null, title), h("div", { className: "panel-copy" }, subtitle))), children);
  }

  function FieldGroup({ title, copy, children, className }) {
    return h(
      "div",
      { className: className ? `field-group ${className}` : "field-group" },
      h("div", { className: "field-group-header" }, h("h3", null, title), copy ? h("p", null, copy) : null),
      h("div", { className: "field-group-grid" }, children)
    );
  }

  function GuidedStepCard({ step, title, copy }) {
    return h(
      "div",
      { className: "guided-step-card" },
      h("p", { className: "tiny-label" }, step),
      h("strong", null, title),
      h("p", { className: "status" }, copy)
    );
  }

  function StageFlowChart({ items, compact }) {
    return h(
      "div",
      { className: compact ? "flow-chart flow-chart-compact" : "flow-chart" },
      items.map(([label, text], index) =>
        h(
          React.Fragment,
          { key: `${label}-${text}` },
          h(
            "div",
            { className: "flow-node" },
            h("span", { className: "flow-node-index" }, label),
            h("span", { className: "flow-node-text" }, text)
          ),
          index < items.length - 1 ? h("div", { className: "flow-arrow", "aria-hidden": "true" }, "→") : null
        )
      )
    );
  }

  function renderInput(label, value, onChange, type) {
    return h("label", { key: label }, label, h("input", { value, type: type || "text", onChange: (event) => onChange(event.target.value) }));
  }

  function renderSelect(label, value, onChange, options) {
    return h("label", { key: label }, label, h("select", { value, onChange: (event) => onChange(event.target.value) }, options.map(([optionValue, text]) => h("option", { value: optionValue, key: optionValue }, text))));
  }

  function renderTextAreaInput(label, value, onChange, placeholder) {
    return h("label", { key: label, className: "grid-span-2" }, label, h("textarea", { value, placeholder: placeholder || "", onChange: (event) => onChange(event.target.value) }));
  }

  function metricBlock(label, value) {
    return h("div", { className: "metric-card", key: label }, h("p", { className: "metric-label" }, label), h("p", { className: "metric-value" }, String(value)));
  }

  function statCard(label, value, copy) {
    return h("div", { className: "hero-stat" }, h("p", { className: "tiny-label" }, label), h("div", { className: "hero-stat-value" }, value), h("p", { className: "hero-stat-copy" }, copy));
  }

  function tag(value) {
    return h("span", { className: "tag", key: value }, value);
  }

  function experimentFallbackName(proteinIntelligence) {
    return proteinIntelligence.resolved_accession || "Protein evidence";
  }

  function buildPredictiveEvidenceMap(proteinIntelligence, plan) {
    const chemistry = proteinIntelligence?.chemistry || {};
    const alphafold = proteinIntelligence?.alphafold || {};
    const featureCounts = proteinIntelligence?.ebi_features?.counts || {};
    const map = [];
    const size = chemistry.molecular_weight_kda;
    const pI = chemistry.theoretical_pI;
    const hydrophobicity = chemistry.hydrophobic_fraction;
    const membraneRisk = chemistry.membrane_retention_risk;
    const aggregationRisk = chemistry.aggregation_risk;
    const domainCount = chemistry.domain_count || featureCounts.DOMAIN || 0;
    const processingCount = chemistry.cleavage_site_count || 0;

    if (size !== undefined && size !== null) {
      let effect = `Expected size is about ${size} kDa, so Butterfly uses this to set the gel window and transfer intensity.`;
      if (size >= 120) {
        effect = `Expected size is about ${size} kDa, which pushes the model toward gentler wet transfer, longer transfer time, and careful cooling rather than aggressive current.`;
      } else if (size <= 25) {
        effect = `Expected size is about ${size} kDa, which pushes the model toward shorter transfer conditions to reduce blow-through and loss from the membrane.`;
      }
      map.push({
        title: "Molecular weight -> transfer plan",
        driver: `Predicted molecular weight ${size} kDa`,
        effect,
        sources: ["FASTA chemistry", "UniProt sequence"],
      });
    }

    if (pI !== undefined && pI !== null) {
      let effect = `Predicted pI is ${pI}, so standard sample and running buffers are a sensible first-pass baseline.`;
      if (pI >= 8.5) {
        effect = `Predicted pI is ${pI}, so Butterfly favours stronger denaturation, enough reducing agent, and caution against under-denaturing a relatively basic target.`;
      } else if (pI <= 5.5) {
        effect = `Predicted pI is ${pI}, so Butterfly keeps a standard Tris-glycine-SDS baseline and suggests tuning transfer before changing the buffer system.`;
      }
      map.push({
        title: "Charge / pI -> buffer compatibility",
        driver: `Theoretical pI ${pI}`,
        effect,
        sources: ["FASTA chemistry"],
      });
    }

    if (hydrophobicity !== undefined || membraneRisk) {
      map.push({
        title: "Hydrophobicity -> membrane and transfer choice",
        driver: `Hydrophobic fraction ${hydrophobicity ?? "n/a"} with membrane-retention risk ${membraneRisk || "unknown"}`,
        effect:
          membraneRisk === "high" || (hydrophobicity || 0) >= 0.38
            ? "Hydrophobic or membrane-associated behaviour pushes Butterfly toward PVDF and gentler transfer conditions, because recovery from the gel may be poorer and patchier under harsher transfer settings."
            : "Hydrophobicity does not strongly oppose a standard first-pass membrane and transfer setup, so Butterfly keeps the transfer recommendation closer to the baseline method.",
        sources: ["FASTA chemistry", "EMBL-EBI features"],
      });
    }

    if (processingCount > 0 || plan?.confounding_bands?.length) {
      map.push({
        title: "Processing / PTM risk -> expected band region",
        driver: processingCount > 0 ? `Processing or cleavage features ${processingCount}` : "Annotated confounding-band risk",
        effect: "Butterfly expands the expected band interpretation beyond the full-length protein alone, because processed, mature, or mobility-shifted species may sit close to the intended band window.",
        sources: ["UniProt annotation", "EMBL-EBI features"],
      });
    }

    if (domainCount > 1 || alphafold.available) {
      const structureLine = alphafold.available
        ? `AlphaFold confidence is ${alphafold.mean_plddt} (${alphafold.confidence_label})`
        : "Multi-domain architecture is annotated";
      map.push({
        title: "Structure / domains -> antibody accessibility caution",
        driver: domainCount > 1 ? `${structureLine}; annotated domains ${domainCount}` : structureLine,
        effect: "Butterfly treats domain architecture and structure confidence as clues for which regions may remain stable or accessible after denaturation, helping the scientist think about antibody region choice and misleading fragments.",
        sources: alphafold.available ? ["AlphaFold", "EMBL-EBI features"] : ["EMBL-EBI features"],
      });
    }

    if (aggregationRisk) {
      map.push({
        title: "Aggregation risk -> sample preparation and blocker caution",
        driver: `Predicted aggregation risk ${aggregationRisk}`,
        effect:
          aggregationRisk === "low"
            ? "Low predicted aggregation risk means Butterfly can keep the first-pass sample preparation closer to the standard denaturing workflow."
            : "Aggregation risk is not low, so Butterfly pushes the scientist toward strong denaturation, fresh reducing buffer, and caution before blaming antibody concentration alone for weak or messy signal.",
        sources: ["FASTA chemistry", "AlphaFold"],
      });
    }

    return map.slice(0, 6);
  }

  function buildPredictiveWorkflowCards(proteinIntelligence, experiment, recommendations, plan) {
    const chemistry = proteinIntelligence?.chemistry || {};
    const bufferCompatibility = proteinIntelligence?.buffer_compatibility || {};
    const counts = proteinIntelligence?.ebi_features?.counts || {};
    const size = Number(chemistry.molecular_weight_kda || 0);
    const pI = chemistry.theoretical_pI;
    const hydrophobicity = chemistry.hydrophobic_fraction;
    const membraneRisk = chemistry.membrane_retention_risk || "unknown";
    const aggregationRisk = chemistry.aggregation_risk || "unknown";
    const abundance = (experiment?.target_abundance_class || "moderate").toLowerCase();
    const primaryType = (experiment?.primary_type || "").toLowerCase();
    const domainCount = chemistry.domain_count || counts.DOMAIN || 0;
    const processingCount = chemistry.cleavage_site_count || 0;
    const isHydrophobic = membraneRisk === "high" || (hydrophobicity || 0) >= 0.38 || (chemistry.hydrophobic_domain_count || 0) > 0;
    const gelPercent = recommendedGelPercent(size || null);
    const runningBuffer = bufferCompatibility.running_buffer || "Tris-glycine-SDS";
    const membraneType = isHydrophobic ? "PVDF" : "Nitrocellulose";
    const transferMode = recommendations?.transfer?.actions?.[0]?.toLowerCase().includes("semi-dry")
      ? "Semi-dry transfer"
      : size && size <= 25
        ? "Semi-dry transfer"
        : "Wet transfer";
    const poreSize = size && size < 40 ? "0.2 um membrane" : "0.45 um membrane";
    const blocker = primaryType === "phospho" ? "2% to 3% BSA" : abundance === "high" || abundance === "very high" ? "2% to 3% milk or BSA" : abundance === "low" || abundance === "very low" ? "2% to 3% BSA or casein" : "3% milk";
    const washPlan = primaryType === "phospho" ? "3 x 5 min TBST" : abundance === "low" || abundance === "very low" ? "3 x 5 min TBST, avoid over-washing" : "3 x 5 to 10 min TBST";

    return [
      {
        title: "Gel running conditions",
        recommended: `${gelPercent} SDS-PAGE with ${runningBuffer}`,
        because: [
          `Size around ${size || "unknown"} kDa points Butterfly to ${gelPercent} as the first gel choice.`,
          pI >= 8.5
            ? `Predicted pI ${pI} is relatively basic, so keep strong denaturation and sufficient reducing agent during sample prep.`
            : pI && pI <= 5.5
              ? `Predicted pI ${pI} is relatively acidic, so keep the standard running-buffer system before changing gel chemistry.`
              : `Predicted pI ${pI || "unknown"} does not strongly push the run away from a standard SDS-PAGE baseline.`,
        ],
        watch: [
          "Use the gel to resolve the expected band window before changing antibody conditions.",
          "If the band compresses or runs unexpectedly, adjust gel percentage before redesigning the whole workflow.",
        ],
      },
      {
        title: "Transfer",
        recommended: `${transferMode} on ${membraneType} using ${poreSize}`,
        because: [
          size && size < 40
            ? "Targets under 40 kDa are at greater risk of blow-through, so Butterfly recommends a 0.2 um membrane."
            : "Larger targets are better retained on a 0.45 um membrane unless you know the protein is unusually small or fragile.",
          isHydrophobic
            ? `Hydrophobicity ${hydrophobicity ?? "n/a"} and membrane-retention risk ${membraneRisk} push the method toward PVDF and gentler transfer handling.`
            : `Hydrophobicity ${hydrophobicity ?? "n/a"} does not strongly oppose a standard membrane-transfer workflow.`,
        ],
        watch: [
          transferMode === "Semi-dry transfer"
            ? "If semi-dry is used, watch larger or more hydrophobic targets carefully because recovery can fall off faster."
            : "Wet transfer is the safer first-pass choice when size or protein chemistry suggests under-transfer risk.",
          "Check for under-transfer before increasing antibody concentration to compensate for missing signal.",
        ],
      },
      {
        title: "Blocking and washing",
        recommended: `${blocker} with ${washPlan}`,
        because: [
          primaryType === "phospho"
            ? "Phospho-style workflows are more compatible with BSA than milk because milk can increase background or competitive phospho-like signal."
            : `Abundance set to ${abundance}, so Butterfly is balancing enough blocking to reduce nonspecific signal without over-masking the target.`,
          abundance === "high" || abundance === "very high"
            ? "For abundant targets, keep blocking lighter and exposures shorter so a strong signal does not become haze."
            : abundance === "low" || abundance === "very low"
              ? "For low-abundance targets, avoid over-blocking and over-washing because the target can disappear before specificity improves."
              : "For moderate abundance, start with a standard blocker and adjust only one variable at a time if background appears.",
        ],
        watch: [
          aggregationRisk !== "low"
            ? `Aggregation risk is ${aggregationRisk}, so improve denaturation and sample quality before assuming the blocker is the main problem.`
            : "If background rises, change blocker or wash stringency before redesigning the whole blot.",
          "Do not over-mask the target by increasing blocker strength and wash stringency at the same time.",
        ],
      },
      {
        title: "Take into consideration",
        recommended: "Review the protein-specific cautions before running the blot",
        because: [
          processingCount > 0
            ? "Processing or cleavage features are present, so compare the observed band against mature and processed forms, not only the full-length protein."
            : "Use the expected molecular-weight window, not a single exact band size, when judging specificity.",
          domainCount > 1
            ? "Multiple domains are annotated, so stable fragments can appear and still react if the antibody binds one retained region."
            : "Check whether the antibody region is likely to remain represented after denaturation and transfer.",
        ],
        watch: [
          `Consider N- and C-terminus context, PTM-related shifts, aggregation risk (${aggregationRisk}), and similar-MW confounders before changing the entire method.`,
          "If the observed band is close to the predicted region but not exact, check protein processing and PTM shift risk before discarding the antibody.",
        ],
      },
    ];
  }

  function recommendedGelPercent(size) {
    if (!size || Number.isNaN(size)) return "10%";
    if (size >= 150) return "6%";
    if (size >= 100) return "7.5%";
    if (size >= 60) return "8%";
    if (size >= 35) return "10%";
    if (size >= 20) return "12%";
    return "15%";
  }

  function buildBlockingInsight(experiment) {
    const antibodyType = experiment.primary_type || "total";
    const abundance = experiment.target_abundance_class || "moderate";
    const blocker = experiment.blocking_reagent || "milk";

    if (antibodyType === "phospho") {
      return {
        title: "BSA is usually the safer first blocker for phospho targets.",
        copy:
          "Milk contains casein and endogenous phosphoproteins, so phospho-specific antibodies can show higher background or apparent competition. Log whether BSA, milk, or casein was actually used so repeat runs can learn from the outcome.",
      };
    }

    if (abundance === "high" || abundance === "very high") {
      return {
        title: "High-abundance targets often need lighter blocking and stricter exposure control.",
        copy:
          "A very strong target can look worse if the method over-blocks, overuses antibody, or overexposes the blot. Butterfly will compare blocker, wash programme, dilution, and exposure against the final image.",
      };
    }

    if (abundance === "low" || abundance === "very low") {
      return {
        title: "Low-abundance targets can be harmed by over-blocking or over-washing.",
        copy:
          "For weak targets, the aim is to preserve specific signal first, then reduce background carefully. The saved log helps Butterfly learn whether the blocker or wash programme removed useful signal.",
      };
    }

    return {
      title: `Current blocker context: ${blocker}.`,
      copy:
        "For total-protein targets at moderate abundance, milk is often acceptable, but BSA or casein can be better when background, phospho-reactivity, biotin/lectin interactions, or antibody-specific nonspecific binding appears.",
    };
  }

  function inferPrimaryType(experiment) {
    const explicit = (experiment.primary_type || "").trim().toLowerCase();
    if (explicit) return explicit;
    const label = `${experiment.primary_target || ""} ${experiment.protein_name || ""}`.toLowerCase();
    if (label.includes("phospho") || label.includes("p-")) return "phospho";
    return "total";
  }

  function recommendedGelPercent(sizeKda) {
    const size = Number(sizeKda);
    if (!Number.isFinite(size)) return "10";
    if (size >= 150) return "6";
    if (size >= 100) return "7.5";
    if (size >= 60) return "8";
    if (size >= 35) return "10";
    if (size >= 20) return "12";
    return "15";
  }

  function recommendedMembrane(proteinIntelligence) {
    const chemistry = proteinIntelligence?.chemistry || {};
    if (chemistry.membrane_retention_risk === "high" || (chemistry.hydrophobic_domain_count || 0) > 0) {
      return "PVDF";
    }
    return "Nitrocellulose";
  }

  function recommendedTransferMode(proteinIntelligence) {
    const chemistry = proteinIntelligence?.chemistry || {};
    const size = Number(chemistry.molecular_weight_kda);
    if ((chemistry.hydrophobic_domain_count || 0) > 0) return "wet";
    if (Number.isFinite(size) && size >= 110) return "wet";
    if (Number.isFinite(size) && size <= 25) return "semi-dry";
    return "wet";
  }

  function recommendedBlocker(experiment, proteinIntelligence) {
    const chemistry = proteinIntelligence?.chemistry || {};
    const primaryType = inferPrimaryType(experiment);
    if (primaryType === "phospho") return "BSA";
    if (chemistry.aggregation_risk === "high") return "BSA";
    return "Milk";
  }

  function recommendedDetection(experiment) {
    const abundance = (experiment.target_abundance_class || "moderate").toLowerCase();
    if (abundance === "very low" || abundance === "low") return "high-sensitivity ECL";
    return "ECL";
  }

  function buildProteinFirstExperiment(experiment, proteinIntelligence) {
    const chemistry = proteinIntelligence?.chemistry || {};
    const size = Number(chemistry.molecular_weight_kda);
    const primaryType = inferPrimaryType(experiment);
    return {
      ...experiment,
      protein_size_kda: experiment.protein_size_kda || (Number.isFinite(size) ? String(Math.round(size)) : ""),
      gel_percent: experiment.gel_percent || recommendedGelPercent(size),
      membrane_type: recommendedMembrane(proteinIntelligence).toLowerCase() === "pvdf" ? "pvdf" : "nitrocellulose",
      transfer_mode: experiment.transfer_mode && experiment.transfer_mode !== "either" ? experiment.transfer_mode : recommendedTransferMode(proteinIntelligence),
      blocking_reagent: recommendedBlocker(experiment, proteinIntelligence).toLowerCase() === "bsa" ? "bsa" : "milk",
      detection_method: experiment.detection_method || recommendedDetection(experiment),
      primary_type: primaryType,
      protein_load_ug: experiment.protein_load_ug || (experiment.target_abundance_class === "very low" || experiment.target_abundance_class === "low" ? "20" : "10"),
      lane_count: experiment.lane_count || "10",
    };
  }

  function buildImageEvidenceSummary(analyses) {
    const available = Object.keys(analyses || {}).filter((stage) => analyses[stage]);
    if (!available.length) {
      return {
        title: "No image evidence uploaded yet.",
        copy:
          "Troubleshooting will still work from the symptom and method fields, but Butterfly can use more image-based evidence if the Experiment Log includes gel, transfer, or final blot images.",
      };
    }

    const labels = available.map((stage) => capitalize(stage)).join(", ");
    const flags = [];
    available.forEach((stage) => {
      const analysis = analyses[stage] || {};
      if ((analysis.saturation_pct || 0) > 3) flags.push(`${stage}: saturation`);
      if ((analysis.background_std || 0) > 28) flags.push(`${stage}: uneven background`);
      if ((analysis.contrast || 0) < 30) flags.push(`${stage}: low contrast`);
      if ((analysis.lane_variation || 0) > 20) flags.push(`${stage}: lane variation`);
      if ((analysis.asymmetry_score || 0) > 18) flags.push(`${stage}: asymmetry`);
      if ((analysis.splice_risk_score || 0) > 8) flags.push(`${stage}: integrity risk`);
    });

    return {
      title: `Image evidence available: ${labels}.`,
      copy: flags.length
        ? `Butterfly will include these image-derived clues: ${flags.slice(0, 6).join(", ")}.`
        : "No major image-derived warning flags are currently detected, but the metrics still help rank likely causes.",
    };
  }

  function scoreOptions() {
    return [["1", "1 - poor"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5 - excellent"]];
  }

  function buildComparison(history, experiment) {
    if (!history.length) return null;
    const relevant = history.filter((item) => {
      const prior = item.payload?.experiment || {};
      return prior.protein_name && experiment.protein_name && prior.protein_name.toLowerCase() === experiment.protein_name.toLowerCase();
    });
    const pool = relevant.length ? relevant : history.slice(0, 6);
    if (!pool.length) return null;

    const bestBy = (field) => {
      const sorted = [...pool].sort((a, b) => Number((b.payload?.experiment || {})[field] || 0) - Number((a.payload?.experiment || {})[field] || 0));
      return sorted[0]?.payload?.experiment || {};
    };

    const bestSignal = bestBy("signal_rating");
    const lowBackground = [...pool].sort((a, b) => Number((a.payload?.experiment || {}).background_rating || 99) - Number((b.payload?.experiment || {}).background_rating || 99))[0]?.payload?.experiment || {};

    const insights = [];
    if (bestSignal.membrane_type) insights.push(`Best prior signal in saved runs used ${bestSignal.membrane_type.toUpperCase()}.`);
    if (bestSignal.transfer_mode) insights.push(`The strongest saved run used ${bestSignal.transfer_mode} transfer.`);
    if (lowBackground.blocking_reagent) insights.push(`The cleanest background in saved runs used ${lowBackground.blocking_reagent}.`);
    if (bestSignal.primary_dilution) insights.push(`A prior higher-signal run used primary dilution ${bestSignal.primary_dilution}.`);
    if (!insights.length) insights.push("Save more runs with outcome ratings to build meaningful internal evidence.");

    return {
      similarRuns: pool.length,
      bestMembrane: bestSignal.membrane_type ? bestSignal.membrane_type.toUpperCase() : "Unknown",
      bestBlocker: lowBackground.blocking_reagent || "Unknown",
      bestTransfer: bestSignal.transfer_mode || "Unknown",
      insights,
    };
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function formatDate(value) {
    if (!value) return "unknown time";
    return new Date(value.replace(" ", "T") + "Z").toLocaleString();
  }

  function buildTags(payload) {
    const experiment = payload.experiment || {};
    const tags = [];
    if (experiment.protein_name) tags.push(experiment.protein_name);
    if (experiment.uniprot_id) tags.push(experiment.uniprot_id);
    if (experiment.overall_outcome) tags.push(experiment.overall_outcome);
    if (payload.analyses && payload.analyses.final) tags.push("final review");
    return tags.slice(0, 5);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  root.render(h(App));
})();
