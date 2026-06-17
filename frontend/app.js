(function () {
  const h = React.createElement;
  const { useEffect, useMemo, useState } = React;
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

    useEffect(() => {
      checkAuth();
    }, []);

    useEffect(() => {
      if (authenticated) {
        fetchHistory();
        fetchIndexStatus();
      }
    }, [authenticated]);

    const comparison = useMemo(() => buildComparison(history, experiment), [history, experiment]);
    const strategyReady = Boolean(proteinIntelligence || experiment.protein_name);
    const finalIntegrityReady = Boolean(analyses.final);

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

    async function generateTroubleshootingPlan() {
      setTroubleshootingLoading(true);
      setStatus("Building troubleshooting decision tree...");
      const response = await fetch("/api/troubleshooting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptom: experiment.troubleshooting_symptom || "high background",
          experiment,
          analyses,
          protein_intelligence: proteinIntelligence || {},
          antibody_compatibility: antibodyCompatibility || {},
        }),
      });
      setTroubleshootingLoading(false);

      if (!response.ok) {
        setStatus("Troubleshooting plan failed.");
        return;
      }

      const payload = await response.json();
      setTroubleshootingPlan(payload);
      setStatus(`Troubleshooting plan ready for ${payload.symptom}.`);
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

    return h(
      "div",
      { className: "app-shell" },
      h(Hero, { experimentCount: history.length, finalIntegrityReady, onLogout: logout }),
      h(
        "div",
        { className: "layout" },
        h(
          "div",
          { className: "stack" },
          h(ProteinIntelligenceSection, {
            number: "01",
            experiment,
            updateField,
            proteinIntelligence,
            onFetchProteinIntelligence: fetchProteinIntelligence,
            onGenerateProteinFirstPlan: generateProteinFirstPlan,
            proteinIntelLoading,
            proteinFirstLoading,
          }),
          h(PredictedStrategySection, {
            number: "02",
            experiment,
            strategyReady,
            recommendations,
            proteinFirstPlan,
            proteinIntelligence,
            onGenerate: generateProteinFirstPlan,
            onSave: saveExperiment,
            onReset: startNew,
            selectedId,
            status,
            proteinFirstLoading,
          }),
          h(AntibodyCompatibilitySection, {
            number: "03",
            experiment,
            updateField,
            antibodyCompatibility,
            onCheck: checkAntibodyCompatibility,
            loading: antibodyCompatibilityLoading,
          }),
          h(ExperimentLogSection, {
            number: "04",
            experiment,
            updateField,
            analyses,
            previews,
            onUpload: analyseStage,
            onAIInterpret: generateAIInterpretation,
            aiInterpretations,
            aiLoadingStage,
          }),
          h(FinalIntegritySection, {
            number: "05",
            finalAnalysis: analyses.final,
            preview: previews.final,
            integrity: recommendations.integrity,
            onUpload: analyseStage,
            onAIInterpret: generateAIInterpretation,
            aiInterpretation: aiInterpretations.final,
            aiLoadingStage,
          }),
          h(VirtualAssistantSection, {
            number: "06",
            experiment,
            updateField,
            analyses,
            comparison,
            troubleshootingPlan,
            onGenerate: generateTroubleshootingPlan,
            loading: troubleshootingLoading,
            docStatus,
            onUploadDocuments: uploadDocuments,
            docUploadLoading,
            proteinIntelligence,
          })
        ),
        h(SidebarPanel, {
          history,
          selectedId,
          onLoad: loadExperiment,
        })
      )
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

  function Hero({ experimentCount, finalIntegrityReady, onLogout }) {
    return h(
      "section",
      { className: "hero" },
      h(
        "div",
        { className: "hero-copy" },
        h("p", { className: "eyebrow" }, "Generative Western Blot Optimisation"),
        h("h1", null, "Butterfly"),
        h(
          "p",
          { className: "subtitle" },
          "A virtual Western blot troubleshooting assistant that turns protein intelligence, antibody evidence, experiment logs, image analysis, and publication integrity checks into an evidence-weighted strategy for the next blot."
        ),
        h("div", { className: "button-row" }, h("button", { className: "button button-ghost", type: "button", onClick: onLogout }, "Log out"))
      ),
      h(
        "div",
        { className: "hero-visual" },
        h("div", { className: "brand-mark-shell" }, h("img", { src: "/assets/butterfly-logo-v6.png?v=1", alt: "Rorschach western blot butterfly mark", className: "brand-mark" })),
        h(
          "div",
          { className: "hero-grid" },
          statCard("Saved runs", String(experimentCount), "Past experiments become internal evidence for the next prediction."),
          statCard("Final integrity", finalIntegrityReady ? "Ready" : "Pending", "The final blot is the publication-readiness checkpoint.")
        )
      )
    );
  }

  function ProteinIntelligenceSection({ number, experiment, updateField, proteinIntelligence, onFetchProteinIntelligence, onGenerateProteinFirstPlan, proteinIntelLoading, proteinFirstLoading }) {
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
            { className: "entry-card-grid" },
            h(
              FieldGroup,
              { title: "Start Here", copy: "Add a UniProt ID, FASTA sequence, or both." },
              renderInput("Experiment title", experiment.title, (value) => updateField("title", value)),
              renderInput("Target protein (optional)", experiment.protein_name, (value) => updateField("protein_name", value)),
              renderInput("UniProt ID (optional)", experiment.uniprot_id, (value) => updateField("uniprot_id", value)),
              renderInput("Organism", experiment.organism_name, (value) => updateField("organism_name", value)),
              renderInput("Expression system (optional)", experiment.expression_system, (value) => updateField("expression_system", value))
            ),
            h(
              FieldGroup,
              { title: "FASTA Sequence", copy: "Paste sequence here if UniProt is unavailable or if you want sequence-led prediction." },
              renderTextAreaInput("FASTA / protein sequence (optional)", experiment.protein_sequence, (value) => updateField("protein_sequence", value), "Paste amino acid sequence or FASTA if UniProt is unavailable, incomplete, or you want sequence-specific prediction.")
            )
          ),
          h("div", { className: "button-row" }, h("button", { className: "button button-primary", type: "button", onClick: onFetchProteinIntelligence, disabled: proteinIntelLoading || !(experiment.uniprot_id || experiment.protein_name || experiment.protein_sequence) }, proteinIntelLoading ? "Loading protein intelligence..." : "Fetch / predict protein intelligence"))
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
            : h("div", { className: "empty-state" }, "Start by entering a UniProt ID, FASTA sequence, or both. Butterfly will then show predictive protein intelligence for you to review before moving to the predictive model.")
        )
      )
    );
  }

  function PredictedStrategySection({ number, experiment, strategyReady, recommendations, proteinFirstPlan, proteinIntelligence, onGenerate, onSave, onReset, selectedId, status, proteinFirstLoading }) {
    return h(
      SectionCard,
      { number, title: "Predictive Strategy", subtitle: "This stage turns the protein characteristics into a first-pass Western blot strategy that the user can review before running anything." },
      h(
        "div",
        { className: "strategy-action-stack" },
        h(
          "div",
          { className: "button-row strategy-button-row" },
          h("button", { className: "button button-primary", type: "button", onClick: onGenerate, disabled: !strategyReady || proteinFirstLoading }, proteinFirstLoading ? "Building strategy..." : "Generate strategy"),
          h("button", { className: "button button-secondary", type: "button", onClick: onSave, disabled: !Object.keys(recommendations).length }, selectedId ? "Update run" : "Save run"),
          h("button", { className: "button button-ghost", type: "button", onClick: onReset }, "New run")
        ),
        h("div", { className: "status strategy-status" }, status),
        h(
          "div",
          { className: "lookup-card strategy-intro-card" },
          h("p", { className: "tiny-label" }, "What this section is doing"),
          h("p", { className: "status" }, "Using UniProt, AlphaFold, EMBL-EBI feature data, and FASTA-derived chemistry from Section 1, Butterfly maps the protein evidence into one predictive Western blot strategy. The goal is to show, concisely, how size, pI, hydrophobicity, domain context, processing risk, and folding behaviour affect buffers, transfer, blocker choice, and the expected band region.")
        )
      ),
      proteinFirstPlan
        ? h(ProteinFirstPlanCard, { plan: proteinFirstPlan, proteinIntelligence, recommendations, experiment })
        : h("div", { className: "empty-state" }, "Review the protein evidence in Stage 01 first, then ask Butterfly to generate the predictive model.")
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

  function AntibodyCompatibilitySection({ number, experiment, updateField, antibodyCompatibility, onCheck, loading }) {
    return h(
      SectionCard,
      { number, title: "Antibody Compatibility", subtitle: "Paste product URLs or use manual fields to score primary validation evidence, clone/manufacturing clues, and whether the secondary matches the primary host, isotype, conjugate, application, and ECL strategy." },
      h(
        "div",
        { className: "entry-card-grid antibody-split-grid" },
        h(
          FieldGroup,
          { title: "Primary Antibody", copy: "Add the target antibody and its product page so Butterfly can extract host species, clone hints, Western blot use, and manufacturer validation evidence." },
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
          { title: "Secondary Antibody", copy: "Add the secondary antibody page so Butterfly can assess whether it is the right anti-species, conjugate, and Western blot partner for the primary." },
          renderSelect("Secondary target species", experiment.secondary_target_species, (value) => updateField("secondary_target_species", value), [["rabbit", "Anti-rabbit"], ["mouse", "Anti-mouse"], ["goat", "Anti-goat"], ["rat", "Anti-rat"], ["other", "Other"]]),
          renderInput("Secondary isotype target", experiment.secondary_isotype, (value) => updateField("secondary_isotype", value)),
          renderSelect("Secondary conjugate", experiment.secondary_conjugate, (value) => updateField("secondary_conjugate", value), [["HRP", "HRP"], ["AP", "AP"], ["fluorescent", "Fluorescent"], ["unknown", "Unknown"]]),
          renderSelect("Detection", experiment.detection_method, (value) => updateField("detection_method", value), [["ECL", "ECL"], ["high-sensitivity ECL", "High-sensitivity ECL"], ["fluorescent", "Fluorescent"], ["other", "Other"]]),
          renderTextAreaInput("Secondary antibody URL", experiment.secondary_url, (value) => updateField("secondary_url", value), "Example: Cytiva / Amersham HRP-linked secondary page.")
        )
      ),
      h("div", { className: "button-row" }, h("button", { className: "button button-primary", type: "button", onClick: onCheck, disabled: loading }, loading ? "Checking..." : "Check compatibility")),
      antibodyCompatibility ? h(AntibodyCompatibilityResult, { result: antibodyCompatibility }) : h("div", { className: "empty-state" }, "Compatibility result will appear here. If a vendor page blocks parsing, Butterfly will still use the manual host/isotype/conjugate fields.")
    );
  }

  function AntibodyCompatibilityResult({ result }) {
    return h(
      "div",
      { className: "recommendation-card comparison-card-wide" },
      h("h3", null, `Compatibility: ${result.status}`),
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

  function VirtualAssistantSection({ number, experiment, updateField, analyses, comparison, troubleshootingPlan, onGenerate, loading, docStatus, onUploadDocuments, docUploadLoading, proteinIntelligence }) {
    const imageEvidence = buildImageEvidenceSummary(analyses);
    return h(
      SectionCard,
      {
        number,
        title: "Virtual Assistant",
        subtitle:
          "Use the final stage for guided support. Butterfly combines the experiment log, uploaded image analysis, protein chemistry, saved runs, and uploaded supporting documents into practical troubleshooting support.",
      },
      h(
        "div",
        { className: "virtual-assistant-stack" },
        h(DecisionTree, { proteinIntelligence }),
        h("div", { className: "dtree-divider" }, h("span", null, "Or use the detailed assistant")),
        h(
        "div",
        { className: "upload-card assistant-upload-card" },
        h("label", null, "Upload supporting PDFs, TXT, or Markdown"),
        h("input", { type: "file", accept: ".pdf,.txt,.md,text/plain,application/pdf,text/markdown", multiple: true, onChange: (event) => onUploadDocuments(event.target.files) }),
        h("div", { className: "tiny-label" }, docUploadLoading ? "Uploading..." : "Upload protocols, datasheets, or troubleshooting notes if you want Butterfly to use your own supporting material.")
      ),
        h(
          "div",
          { className: "lookup-card assistant-context-card" },
          h("p", { className: "tiny-label" }, "What Butterfly is using"),
          h("strong", null, imageEvidence.title),
          h("p", { className: "status" }, imageEvidence.copy)
        ),
        h(
          "div",
          { className: "grid assistant-input-grid" },
          renderSelect("Observed problem", experiment.troubleshooting_symptom, (value) => updateField("troubleshooting_symptom", value), [
            ["high background", "High background"],
            ["ghost bands", "Ghost bands"],
            ["non-specific bands", "Non-specific bands"],
            ["weak signal", "Weak signal"],
            ["no signal", "No signal"],
            ["smearing", "Smearing"],
          ]),
          renderSelect("Target abundance context", experiment.target_abundance_class, (value) => updateField("target_abundance_class", value), [["very low", "Very low"], ["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["very high", "Very high"]])
        ),
        h("div", { className: "button-row assistant-button-row" }, h("button", { className: "button button-primary", type: "button", onClick: onGenerate, disabled: loading }, loading ? "Building assistant support..." : "Generate assistant support")),
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
                h("h3", null, "What saved runs suggest"),
                h("ul", null, comparison.insights.map((item, index) => h("li", { key: index }, item)))
              )
            )
          : null,
        troubleshootingPlan
          ? h(TroubleshootingResult, { plan: troubleshootingPlan })
          : h("div", { className: "empty-state" }, "Upload optional gel, transfer, or final blot images in the Experiment Log first if you want Butterfly to use image metrics such as background spread, contrast, saturation, asymmetry, and lane variation.")
      )
    );
  }

  const SYMPTOM_TREES = {
    faint: {
      label: "Faint or no signal",
      icon: "◐",
      blurb: "Bands too weak — or nothing at all. We rule out transfer and detection before touching the antibody.",
      questions: [
        {
          id: "transfer",
          q: "Does a total-protein stain (Ponceau / REVERT) show even transfer?",
          why: "If protein never reached the membrane, no antibody change can rescue the blot.",
          options: [
            { label: "Yes — transfer looks even", tips: [] },
            { label: "No — weak or patchy", tips: [
              { title: "Optimise transfer before anything else", why: "Patchy or weak transfer is the direct cause of missing signal — fix this first.", impact: 0.92, effort: "Moderate" },
            ] },
            { label: "I haven't checked", tips: [
              { title: "Run a total-protein stain to confirm transfer", why: "Tells you whether the problem is transfer or detection before you change other variables.", impact: 0.8, effort: "Easy" },
            ] },
          ],
        },
        {
          id: "abundance",
          q: "How abundant is your target in this sample?",
          why: "Low-abundance targets usually just need more antibody or more sensitive detection.",
          options: [
            { label: "Low / rare", tips: [
              { title: "Increase primary antibody (e.g. 1:2000 → 1:1000)", why: "Low-abundance targets need more antibody to produce detectable signal.", impact: 0.85, effort: "Trivial" },
              { title: "Switch to a high-sensitivity ECL substrate", why: "Boosts detection for rare targets without overloading the gel.", impact: 0.7, effort: "Easy" },
            ] },
            { label: "Moderate / high", tips: [
              { title: "Increase sample load modestly", why: "When abundance isn't limiting, more target on the gel lifts signal.", impact: 0.5, effort: "Easy" },
            ] },
            { label: "Not sure", tips: [
              { title: "Run a positive-control lysate", why: "Confirms the antibody works and that your sample actually expresses the target.", impact: 0.65, effort: "Moderate" },
            ] },
          ],
        },
        {
          id: "blocking",
          q: "Is your blocking strong or prolonged (e.g. 5% milk, or blocking overnight)?",
          why: "Over-blocking can mask the epitope and out-compete the antibody, suppressing signal — especially for low-abundance or phospho targets.",
          options: [
            { label: "Yes — 5% and/or long / overnight", tips: [
              { title: "Reduce blocker concentration and time (e.g. 5% → 2–3%, 1 h at RT)", why: "Too much blocker can coat the epitope and lower signal; a lighter block often recovers faint bands.", impact: 0.72, effort: "Trivial" },
            ] },
            { label: "No — moderate (≤3%, ~1 h)", tips: [] },
          ],
        },
        {
          id: "washing",
          q: "Are your washes long or harsh (several 10-min TBST washes)?",
          why: "Over-washing strips weak signal from lower-affinity antibodies.",
          options: [
            { label: "Yes, fairly harsh", tips: [
              { title: "Shorten and soften washes", why: "Excess washing removes weakly-bound antibody and kills faint signal.", impact: 0.55, effort: "Trivial" },
            ] },
            { label: "No, gentle", tips: [] },
          ],
        },
      ],
    },
    background: {
      label: "High background",
      icon: "▒",
      blurb: "A hazy or dirty membrane. We separate detection/washing causes from sample-loading causes.",
      questions: [
        {
          id: "spread",
          q: "Is the haze across the whole membrane, or only in the lanes?",
          why: "Whole-membrane haze points to blocking/secondary; lane-only points to the sample.",
          options: [
            { label: "Whole membrane", tips: [
              { title: "Dilute the secondary antibody one step further", why: "Excess secondary is the most common cause of uniform background.", impact: 0.82, effort: "Trivial" },
              { title: "Increase wash volume — 4 × 8–10 min TBST", why: "More thorough washing clears unbound antibody across the whole membrane.", impact: 0.7, effort: "Trivial" },
            ] },
            { label: "Mostly in the lanes", tips: [
              { title: "Lower sample load / add a lighter-load lane", why: "Overloaded lanes look dirty even when antibody conditions are fine.", impact: 0.68, effort: "Easy" },
            ] },
            { label: "Speckled / spotty", tips: [
              { title: "Filter or freshly prepare antibody & blocker; keep membrane wet", why: "Speckling comes from particulates, precipitated antibody, or dry membrane spots.", impact: 0.6, effort: "Easy" },
            ] },
          ],
        },
        {
          id: "blocker",
          q: "Are you using milk as your blocker?",
          why: "Milk adds phospho-related background with phospho-specific antibodies.",
          options: [
            { label: "Yes, milk — phospho antibody", tips: [
              { title: "Switch from milk to BSA", why: "Milk contains phosphoproteins that raise background for phospho-specific antibodies.", impact: 0.75, effort: "Trivial" },
            ] },
            { label: "Yes, milk — total protein", tips: [] },
            { label: "No, BSA / other", tips: [] },
          ],
        },
        {
          id: "overblock",
          q: "Have you been raising blocker concentration to fight the background?",
          why: "Piling on blocker (e.g. 5%+ milk) trades background for lost signal and rarely fixes the real cause.",
          options: [
            { label: "Yes — I keep increasing it", tips: [
              { title: "Stop over-blocking — keep blocker ~3% and fix washes/secondary first", why: "Excess blocker suppresses true signal without curing background; thorough washing and a more dilute secondary address the actual cause.", impact: 0.6, effort: "Trivial" },
            ] },
            { label: "No — it's been steady", tips: [] },
          ],
        },
        {
          id: "exposure",
          q: "Does background appear mainly on long exposures?",
          why: "Long exposure and high-sensitivity ECL can surface low-level noise.",
          options: [
            { label: "Yes, on long exposures", tips: [
              { title: "Capture short/medium/long exposures and shorten default", why: "Distinguishes real background from imaging saturation and over-exposure.", impact: 0.5, effort: "Trivial" },
            ] },
            { label: "No, present even when short", tips: [] },
          ],
        },
      ],
    },
    extra: {
      label: "Extra / ghost bands",
      icon: "≣",
      blurb: "Bands you didn't expect. We check whether they're real biology before blaming the antibody.",
      questions: [
        {
          id: "size",
          q: "Do the extra bands match known isoforms, processed, or degradation sizes?",
          why: "Extra bands at expected biological sizes may be real, not artefact.",
          options: [
            { label: "Yes — they match expected sizes", tips: [
              { title: "Verify against UniProt / EMBL-EBI feature annotations", why: "Confirms whether extra bands are genuine isoforms/processing before changing the method.", impact: 0.7, effort: "Easy" },
            ] },
            { label: "No — they look random", tips: [
              { title: "Dilute primary one step, keep secondary constant", why: "Over-concentrated primary is a common source of non-specific extra bands.", impact: 0.72, effort: "Trivial" },
            ] },
            { label: "Not sure", tips: [
              { title: "Run a no-primary (secondary-only) control", why: "Tells you instantly whether extra bands come from the primary or the secondary/membrane.", impact: 0.78, effort: "Easy" },
            ] },
          ],
        },
        {
          id: "lanes",
          q: "Do the extra bands appear in every lane, or vary by sample?",
          why: "All-lane bands point to reagents; sample-varying points to biology.",
          options: [
            { label: "Every lane", tips: [
              { title: "Run no-primary + positive/negative controls", why: "All-lane bands usually come from secondary cross-reactivity or the membrane.", impact: 0.68, effort: "Moderate" },
            ] },
            { label: "Varies by sample", tips: [
              { title: "Compare expression biology, lysis & degradation risk", why: "Sample-dependent bands are often genuine biological variation or degradation.", impact: 0.55, effort: "Moderate" },
            ] },
          ],
        },
        {
          id: "validation",
          q: "Is the antibody clone well-validated for Western blot?",
          why: "Poorly-validated clones are a frequent root cause of extra bands.",
          options: [
            { label: "Yes, strong WB validation", tips: [] },
            { label: "No / not sure", tips: [
              { title: "Check clone-level WB evidence (CiteAb / BenchSci)", why: "A weakly-validated clone may be the cause — worth checking before changing the method.", impact: 0.6, effort: "Moderate" },
            ] },
          ],
        },
      ],
    },
    smearing: {
      label: "Smearing",
      icon: "░",
      blurb: "Fuzzy or streaked bands. We find where the smear starts — sample, gel, or transfer.",
      questions: [
        {
          id: "origin",
          q: "Where does the smear begin?",
          why: "The origin of the smear points to the stage that needs fixing.",
          options: [
            { label: "In the gel", tips: [
              { title: "Lower sample load & use fresh reducing buffer", why: "Overloading and incomplete denaturation cause smearing that starts in the gel.", impact: 0.78, effort: "Trivial" },
              { title: "Spin the lysate before loading", why: "Removes debris and aggregates that streak through the lane.", impact: 0.6, effort: "Trivial" },
            ] },
            { label: "After transfer", tips: [
              { title: "Check transfer heat, current & membrane contact", why: "Excess heat or poor contact during transfer smears bands.", impact: 0.7, effort: "Moderate" },
            ] },
            { label: "Only the target smears", tips: [
              { title: "Consider aggregation / PTMs — adjust denaturation", why: "A single smeared target often reflects aggregation or modification, not the whole method.", impact: 0.62, effort: "Moderate" },
            ] },
          ],
        },
        {
          id: "salt",
          q: "Could the sample have high salt or nucleic-acid contamination?",
          why: "Salt and DNA/RNA distort migration and cause smearing.",
          options: [
            { label: "Possibly", tips: [
              { title: "Clean up sample (desalt / nuclease) before re-running", why: "High salt or nucleic acid contamination distorts migration and smears lanes.", impact: 0.55, effort: "Moderate" },
            ] },
            { label: "Unlikely", tips: [] },
          ],
        },
        {
          id: "gelpct",
          q: "Is your gel percentage matched to the target size?",
          why: "A mismatched gel % resolves poorly and can look like smearing.",
          options: [
            { label: "Yes, matched", tips: [] },
            { label: "No / not sure", tips: [
              { title: "Match gel % to target molecular weight", why: "The right gel % sharpens resolution in your target's size range.", impact: 0.5, effort: "Easy" },
            ] },
          ],
        },
      ],
    },
  };

  function rankSuggestions(tree, answers, proteinIntelligence) {
    const collected = [];
    tree.questions.forEach((question) => {
      const chosen = answers[question.id];
      if (chosen === undefined || chosen === null) return;
      const option = question.options[chosen];
      if (option && option.tips) collected.push(...option.tips);
    });

    // Protein-aware additions (guarded so missing data never throws)
    const chemistry = (proteinIntelligence && proteinIntelligence.chemistry) || {};
    const membraneRisk = chemistry.membrane_retention_risk;
    const hydrophobicDomains = Number(chemistry.hydrophobic_domain_count || 0);
    if ((membraneRisk === "high" || hydrophobicDomains > 0) && (tree.label.indexOf("Faint") === 0 || tree.label.indexOf("Smear") === 0)) {
      collected.push({
        title: "Prefer PVDF + gentle wet transfer",
        why: "Your protein looks hydrophobic / membrane-associated, so transfer conditions matter more than antibody.",
        impact: 0.66,
        effort: "Moderate",
      });
    }

    const byTitle = {};
    collected.forEach((tip) => {
      if (!byTitle[tip.title] || byTitle[tip.title].impact < tip.impact) byTitle[tip.title] = tip;
    });
    return Object.values(byTitle).sort((a, b) => b.impact - a.impact).slice(0, 5);
  }

  function impactLabel(impact) {
    if (impact >= 0.75) return "High impact";
    if (impact >= 0.55) return "Medium impact";
    return "Worth trying";
  }

  function DecisionTree({ proteinIntelligence }) {
    const [symptomKey, setSymptomKey] = useState(null);
    const [answers, setAnswers] = useState({});
    const [stepIndex, setStepIndex] = useState(0);

    function pickSymptom(key) {
      setSymptomKey(key);
      setAnswers({});
      setStepIndex(0);
    }

    function chooseOption(questionId, optionIndex) {
      setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
      setStepIndex((current) => current + 1);
    }

    function goBack() {
      setStepIndex((current) => Math.max(0, current - 1));
    }

    function restart() {
      setSymptomKey(null);
      setAnswers({});
      setStepIndex(0);
    }

    // Step 1: choose a symptom
    if (!symptomKey) {
      return h(
        "div",
        { className: "dtree" },
        h("p", { className: "dtree-kicker" }, "Guided troubleshooting"),
        h("h3", { className: "dtree-title" }, "What does your blot look like?"),
        h("p", { className: "dtree-sub" }, "Pick the closest symptom. Butterfly will ask a few quick questions and rank the fixes most likely to help — so you can decide confidently on your own."),
        h(
          "div",
          { className: "dtree-symptom-grid" },
          Object.keys(SYMPTOM_TREES).map((key) => {
            const tree = SYMPTOM_TREES[key];
            return h(
              "button",
              { key, type: "button", className: "dtree-symptom-card", onClick: () => pickSymptom(key) },
              h("span", { className: "dtree-symptom-icon", "aria-hidden": "true" }, tree.icon),
              h("span", { className: "dtree-symptom-label" }, tree.label),
              h("span", { className: "dtree-symptom-blurb" }, tree.blurb)
            );
          })
        )
      );
    }

    const tree = SYMPTOM_TREES[symptomKey];
    const questions = tree.questions;
    const finished = stepIndex >= questions.length;

    // Step 2: ask questions
    if (!finished) {
      const question = questions[stepIndex];
      return h(
        "div",
        { className: "dtree" },
        h(
          "div",
          { className: "dtree-head" },
          h("button", { type: "button", className: "dtree-back", onClick: stepIndex === 0 ? restart : goBack }, "‹ Back"),
          h("span", { className: "dtree-step-label" }, `${tree.label} · Question ${stepIndex + 1} of ${questions.length}`)
        ),
        h(
          "div",
          { className: "dtree-progress" },
          questions.map((_, idx) =>
            h("span", { key: idx, className: idx <= stepIndex ? "dtree-dot dtree-dot-on" : "dtree-dot" })
          )
        ),
        h("h3", { className: "dtree-question" }, question.q),
        h("p", { className: "dtree-why" }, question.why),
        h(
          "div",
          { className: "dtree-options" },
          question.options.map((option, idx) =>
            h(
              "button",
              { key: idx, type: "button", className: "dtree-option", onClick: () => chooseOption(question.id, idx) },
              h("span", { className: "dtree-option-label" }, option.label),
              h("span", { className: "dtree-option-arrow", "aria-hidden": "true" }, "›")
            )
          )
        )
      );
    }

    // Step 3: ranked suggestions
    const suggestions = rankSuggestions(tree, answers, proteinIntelligence);
    return h(
      "div",
      { className: "dtree" },
      h(
        "div",
        { className: "dtree-head" },
        h("button", { type: "button", className: "dtree-back", onClick: goBack }, "‹ Back"),
        h("span", { className: "dtree-step-label" }, `${tree.label} · Recommended fixes`)
      ),
      h("h3", { className: "dtree-title" }, "Try these, in order"),
      h("p", { className: "dtree-sub" }, "Ranked by how likely each is to fix your blot, based on your answers. Start at the top and change one thing at a time."),
      h(
        "div",
        { className: "dtree-results" },
        suggestions.length
          ? suggestions.map((tip, idx) =>
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
          : h("div", { className: "empty-state" }, "No specific fixes matched — try the detailed assistant below.")
      ),
      h("div", { className: "dtree-restart-row" }, h("button", { type: "button", className: "dtree-restart", onClick: restart }, "Start over"))
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

    return h(
      "div",
      { className: "intel-results" },
      h("div", { className: "metric-grid" }, metricBlock("Accession", proteinIntelligence.resolved_accession || "Not resolved"), metricBlock("Predicted pI", chemistry.theoretical_pI ?? "n/a"), metricBlock("MW (kDa)", chemistry.molecular_weight_kda ?? "n/a"), metricBlock("AlphaFold pLDDT", proteinIntelligence.alphafold?.mean_plddt ?? "n/a"), metricBlock("Membrane retention risk", chemistry.membrane_retention_risk ?? "n/a"), metricBlock("Aggregation risk", chemistry.aggregation_risk ?? "n/a")),
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

  function AIInterpretationCard({ interpretation, compact }) {
    return h(
      "div",
      { className: compact ? "lookup-card ai-card" : "recommendation-card comparison-card-wide ai-card" },
      h("p", { className: "tiny-label" }, `AI image interpretation${interpretation.source === "fallback" ? " · fallback mode" : interpretation.model ? ` · ${interpretation.model}` : ""}`),
      h("p", { className: "status" }, interpretation.summary),
      interpretation.quality_flags?.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "Quality flags"), h("ul", null, interpretation.quality_flags.map((item, index) => h("li", { key: index }, item)))) : null,
      interpretation.band_interpretation?.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "Band interpretation"), h("ul", null, interpretation.band_interpretation.map((item, index) => h("li", { key: index }, item)))) : null,
      interpretation.possible_causes?.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "Possible causes"), h("ul", null, interpretation.possible_causes.map((item, index) => h("li", { key: index }, item)))) : null,
      interpretation.next_steps?.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "Next steps"), h("ul", null, interpretation.next_steps.map((item, index) => h("li", { key: index }, item)))) : null,
      interpretation.confidence ? h("div", { className: "score-pill score-warn" }, interpretation.confidence) : null
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
