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
    const [proteinIntelligence, setProteinIntelligence] = useState(null);
    const [antibodyCompatibility, setAntibodyCompatibility] = useState(null);
    const [troubleshootingPlan, setTroubleshootingPlan] = useState(null);
    const [history, setHistory] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [status, setStatus] = useState("Butterfly is ready to propose the next blot strategy.");
    const [previews, setPreviews] = useState({});
    const [proteinIntelLoading, setProteinIntelLoading] = useState(false);
    const [antibodyCompatibilityLoading, setAntibodyCompatibilityLoading] = useState(false);
    const [troubleshootingLoading, setTroubleshootingLoading] = useState(false);

    useEffect(() => {
      checkAuth();
    }, []);

    useEffect(() => {
      if (authenticated) {
        fetchHistory();
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
      setStatus("Logged out of Butterfly.");
    }

    async function fetchHistory() {
      const response = await fetch("/api/experiments");
      const items = await response.json();
      setHistory(items);
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
        return;
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
          protein_intelligence: proteinIntelligence || {},
          antibody_compatibility: antibodyCompatibility || {},
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
      setProteinIntelligence(payload.payload.protein_intelligence || null);
      setAntibodyCompatibility(payload.payload.antibody_compatibility || null);
      setTroubleshootingPlan(payload.payload.troubleshooting_plan || null);
      setStatus(`Loaded experiment #${payload.id}.`);
    }

    function startNew() {
      setSelectedId(null);
      setExperiment(defaultExperiment);
      setAnalyses({});
      setRecommendations({});
      setProteinIntelligence(null);
      setAntibodyCompatibility(null);
      setTroubleshootingPlan(null);
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
            proteinIntelLoading,
          }),
          h(PredictedStrategySection, {
            number: "02",
            strategyReady,
            recommendations,
            proteinIntelligence,
            onGenerate: generateRecommendations,
            onSave: saveExperiment,
            onReset: startNew,
            selectedId,
            status,
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
          }),
          h(TroubleshootingSection, {
            number: "05",
            experiment,
            updateField,
            analyses,
            troubleshootingPlan,
            onGenerate: generateTroubleshootingPlan,
            loading: troubleshootingLoading,
          }),
          h(RunComparisonSection, { number: "06", comparison }),
          h(FinalIntegritySection, {
            number: "07",
            finalAnalysis: analyses.final,
            preview: previews.final,
            integrity: recommendations.integrity,
            onUpload: analyseStage,
          })
        ),
        h(HistoryPanel, { number: "08", history, selectedId, onLoad: loadExperiment })
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
          h("button", { className: "button button-primary", type: "submit", disabled: loading || !password }, loading ? "Opening Butterfly..." : "Open Butterfly"),
          h("p", { className: "status" }, "For local testing, the default password is butterfly-demo unless you set BUTTERFLY_PASSWORD.")
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

  function ProteinIntelligenceSection({ number, experiment, updateField, proteinIntelligence, onFetchProteinIntelligence, proteinIntelLoading }) {
    return h(
      SectionCard,
      {
        number,
        title: "Protein Intelligence",
        subtitle:
          "Acquire and predict from a UniProt ID and/or FASTA protein sequence, integrating UniProt, AlphaFold, EMBL-EBI, PDB context, and sequence chemistry before setting the blot strategy.",
      },
      h(
        "div",
        { className: "stage-one-layout" },
        h(
          "div",
          { className: "intel-card" },
          h("p", { className: "tiny-label" }, "Sources"),
          h("div", { className: "tag-row" }, tag("UniProt ID"), tag("FASTA sequence"), tag("AlphaFold"), tag("EMBL-EBI"), tag("PDB context"), tag("Protein chemistry")),
          h("div", { className: "button-row" }, h("button", { className: "button button-primary", type: "button", onClick: onFetchProteinIntelligence, disabled: proteinIntelLoading || !(experiment.uniprot_id || experiment.protein_name || experiment.protein_sequence) }, proteinIntelLoading ? "Loading protein intelligence..." : "Fetch / predict protein intelligence")),
          proteinIntelligence ? h(ProteinIntelligencePane, { proteinIntelligence }) : h("div", { className: "empty-state" }, "Enter a UniProt ID, paste a FASTA/protein sequence, or use both. Butterfly will translate this into membrane retention, cleavage, aggregation, and buffer guidance.")
        ),
        h(
          "div",
          { className: "plan-card" },
          h(
            "div",
            { className: "entry-card-grid" },
            h(
              FieldGroup,
              { title: "Target Identity", copy: "Use whichever identifier the scientist has first. UniProt plus FASTA gives Butterfly the strongest starting context." },
              renderInput("Experiment title", experiment.title, (value) => updateField("title", value)),
              renderInput("Target protein", experiment.protein_name, (value) => updateField("protein_name", value)),
              renderInput("UniProt ID (optional)", experiment.uniprot_id, (value) => updateField("uniprot_id", value)),
              renderInput("Organism", experiment.organism_name, (value) => updateField("organism_name", value))
            ),
            h(
              FieldGroup,
              { title: "Sequence Intelligence", copy: "Paste FASTA when you want hydrophobicity, cleavage, aggregation, and buffer predictions even without a UniProt match." },
              renderTextAreaInput("FASTA / protein sequence (optional)", experiment.protein_sequence, (value) => updateField("protein_sequence", value), "Paste amino acid sequence or FASTA if UniProt is unavailable, incomplete, or you want sequence-specific prediction.")
            ),
            h(
              FieldGroup,
              { title: "Gel And Load Setup", copy: "These values shape abundance, transfer, blocking, and exposure recommendations." },
              renderInput("Protein size (kDa)", experiment.protein_size_kda, (value) => updateField("protein_size_kda", value), "number"),
              renderInput("Load per lane (ug)", experiment.protein_load_ug, (value) => updateField("protein_load_ug", value), "number"),
              renderSelect("Target abundance", experiment.target_abundance_class, (value) => updateField("target_abundance_class", value), [["very low", "Very low"], ["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["very high", "Very high"]]),
              renderInput("Lane count", experiment.lane_count, (value) => updateField("lane_count", value), "number"),
              renderInput("Gel percentage", experiment.gel_percent, (value) => updateField("gel_percent", value), "number")
            ),
            h(
              FieldGroup,
              { title: "Blotting Preferences", copy: "Give Butterfly your available hardware and first-pass blocking preference." },
              renderSelect("Membrane", experiment.membrane_type, (value) => updateField("membrane_type", value), [["pvdf", "PVDF"], ["nitrocellulose", "Nitrocellulose"]]),
              renderSelect("Transfer mode", experiment.transfer_mode, (value) => updateField("transfer_mode", value), [["either", "Suggest one"], ["wet", "Wet"], ["semi-dry", "Semi-dry"]]),
              renderSelect("Blocking reagent", experiment.blocking_reagent, (value) => updateField("blocking_reagent", value), [["milk", "5% milk"], ["bsa", "5% BSA"], ["casein", "Casein"], ["other", "Other"]])
            )
          )
        )
      )
    );
  }

  function PredictedStrategySection({ number, strategyReady, recommendations, proteinIntelligence, onGenerate, onSave, onReset, selectedId, status }) {
    const strategyCards = [
      ["transfer", "Transfer"],
      ["blocking", "Blocking and washing"],
      ["antibody", "Antibody and ECL"],
    ];
    return h(
      SectionCard,
      { number, title: "Predicted Best Strategy", subtitle: "Butterfly should recommend the best starting protocol before the user commits to a run." },
      h(
        "div",
        { className: "button-row" },
        h("button", { className: "button button-primary", type: "button", onClick: onGenerate, disabled: !strategyReady }, "Generate strategy"),
        h("button", { className: "button button-secondary", type: "button", onClick: onSave, disabled: !Object.keys(recommendations).length }, selectedId ? "Update run" : "Save run"),
        h("button", { className: "button button-ghost", type: "button", onClick: onReset }, "New run")
      ),
      h("div", { className: "status" }, status),
      proteinIntelligence ? h(ChemistrySummaryCard, { proteinIntelligence }) : null,
      recommendations.blocking ? h(SuggestedStepsCard, { recommendation: recommendations.blocking }) : null,
      Object.keys(recommendations).length
        ? h("div", { className: "recommendation-grid" }, strategyCards.map(([key, label]) => recommendations[key] ? h(RecommendationCard, { key, title: label, recommendation: recommendations[key] }) : null))
        : h("div", { className: "empty-state" }, "Generate a strategy after loading protein intelligence or entering the core blot variables.")
    );
  }

  function ExperimentLogSection({ number, experiment, updateField, analyses, previews, onUpload }) {
    const blockingInsight = buildBlockingInsight(experiment);
    return h(
      SectionCard,
      { number, title: "Experiment Log", subtitle: "Intermediate evidence is optional. Log what you actually did so Butterfly can learn what worked and what failed across repeat runs." },
      h(
        "div",
        { className: "lookup-card" },
        h("p", { className: "tiny-label" }, "Predictive blocking context"),
        h("strong", null, blockingInsight.title),
        h("p", { className: "status" }, blockingInsight.copy)
      ),
      h(
        "div",
        { className: "entry-card-grid" },
        h(
          FieldGroup,
          { title: "Transfer And Wash", copy: "Record the physical conditions that most often explain uneven transfer, weak signal, or background." },
          renderInput("Transfer time", experiment.transfer_time, (value) => updateField("transfer_time", value)),
          renderInput("Transfer current / voltage", experiment.transfer_current, (value) => updateField("transfer_current", value)),
          renderInput("Wash program", experiment.wash_program, (value) => updateField("wash_program", value)),
          renderSelect("Blocking reagent used", experiment.blocking_reagent, (value) => updateField("blocking_reagent", value), [["milk", "Milk"], ["bsa", "BSA"], ["casein", "Casein"], ["other", "Other"]])
        ),
        h(
          FieldGroup,
          { title: "Detection Conditions", copy: "Keep antibody use and exposure together so repeat runs can learn what caused signal versus haze." },
          renderSelect("Detection method", experiment.detection_method, (value) => updateField("detection_method", value), [["ECL", "ECL"], ["high-sensitivity ECL", "High-sensitivity ECL"], ["fluorescent", "Fluorescent"], ["other", "Other"]]),
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
        )
      ),
      h(
        FieldGroup,
        { title: "Image Evidence", copy: "Optional uploads make troubleshooting more adaptive by adding contrast, saturation, lane variation, and background metrics." },
        h(
          "div",
          { className: "optional-evidence-grid" },
          h(ImagePanelMini, { title: "Optional gel image", stage: "gel", analysis: analyses.gel, preview: previews.gel, onUpload }),
          h(ImagePanelMini, { title: "Optional transfer image", stage: "transfer", analysis: analyses.transfer, preview: previews.transfer, onUpload })
        )
      ),
      h(
        FieldGroup,
        { title: "Scientist Notes", copy: "Use this for anything the structured fields miss." },
        h("label", null, "Run notes", h("textarea", { value: experiment.notes, onChange: (event) => updateField("notes", event.target.value), placeholder: "What changed, what improved, and what failed?" }))
      )
    );
  }

  function AntibodyCompatibilitySection({ number, experiment, updateField, antibodyCompatibility, onCheck, loading }) {
    return h(
      SectionCard,
      { number, title: "Antibody Compatibility", subtitle: "Paste product URLs or use manual fields to score primary validation evidence, clone/manufacturing clues, and whether the secondary matches the primary host, isotype, conjugate, application, and ECL strategy." },
      h(
        "div",
        { className: "grid" },
        renderInput("Primary target", experiment.primary_target, (value) => updateField("primary_target", value)),
        renderInput("Primary supplier", experiment.primary_company, (value) => updateField("primary_company", value)),
        renderTextAreaInput("Primary antibody URL", experiment.primary_url, (value) => updateField("primary_url", value), "Example: Abcam primary antibody product page."),
        renderTextAreaInput("Secondary antibody URL", experiment.secondary_url, (value) => updateField("secondary_url", value), "Example: Cytiva / Amersham HRP-linked secondary page."),
        renderInput("Primary clone / catalog hint", experiment.primary_clone, (value) => updateField("primary_clone", value)),
        renderSelect("Antibody type", experiment.primary_type, (value) => updateField("primary_type", value), [["total", "Total protein"], ["phospho", "Phospho-specific"], ["loading-control", "Loading control"], ["low-abundance", "Low abundance"]]),
        renderSelect("Primary host species", experiment.primary_host, (value) => updateField("primary_host", value), [["rabbit", "Rabbit"], ["mouse", "Mouse"], ["goat", "Goat"], ["rat", "Rat"], ["other", "Other"]]),
        renderInput("Primary isotype", experiment.primary_isotype, (value) => updateField("primary_isotype", value)),
        renderSelect("Secondary target species", experiment.secondary_target_species, (value) => updateField("secondary_target_species", value), [["rabbit", "Anti-rabbit"], ["mouse", "Anti-mouse"], ["goat", "Anti-goat"], ["rat", "Anti-rat"], ["other", "Other"]]),
        renderInput("Secondary isotype target", experiment.secondary_isotype, (value) => updateField("secondary_isotype", value)),
        renderSelect("Secondary conjugate", experiment.secondary_conjugate, (value) => updateField("secondary_conjugate", value), [["HRP", "HRP"], ["AP", "AP"], ["fluorescent", "Fluorescent"], ["unknown", "Unknown"]]),
        renderSelect("Detection", experiment.detection_method, (value) => updateField("detection_method", value), [["ECL", "ECL"], ["high-sensitivity ECL", "High-sensitivity ECL"], ["fluorescent", "Fluorescent"], ["other", "Other"]])
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
      h("div", { className: `score-pill ${result.validation_score >= 0.72 ? "score-good" : result.validation_score >= 0.48 ? "score-warn" : "score-bad"}` }, `Primary validation ${Math.round((result.validation_score || 0) * 100)}% · ${result.validation_label || "limited"}`),
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

  function TroubleshootingSection({ number, experiment, updateField, analyses, troubleshootingPlan, onGenerate, loading }) {
    const imageEvidence = buildImageEvidenceSummary(analyses);
    return h(
      SectionCard,
      {
        number,
        title: "Virtual Troubleshooting",
        subtitle:
          "Select the blot problem after logging the run. Butterfly combines the experiment log, uploaded image analysis, protein chemistry, and antibody evidence into a decision tree.",
      },
      h(
        "div",
        { className: "lookup-card" },
        h("p", { className: "tiny-label" }, "Image evidence feeding troubleshooting"),
        h("strong", null, imageEvidence.title),
        h("p", { className: "status" }, imageEvidence.copy)
      ),
      h(
        "div",
        { className: "grid" },
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
      h("div", { className: "button-row" }, h("button", { className: "button button-primary", type: "button", onClick: onGenerate, disabled: loading }, loading ? "Generating decision tree..." : "Generate troubleshooting support")),
      troubleshootingPlan
        ? h(TroubleshootingResult, { plan: troubleshootingPlan })
        : h("div", { className: "empty-state" }, "Upload optional gel, transfer, or final blot images in the Experiment Log first if you want Butterfly to use image metrics such as background spread, contrast, saturation, asymmetry, and lane variation.")
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

  function RunComparisonSection({ number, comparison }) {
    return h(
      SectionCard,
      { number, title: "Run Comparison", subtitle: "Use previous runs as internal evidence. Butterfly should eventually turn these deltas into DoE-like next-step suggestions." },
      comparison
        ? h(
            "div",
            { className: "comparison-grid" },
            metricBlock("Similar runs", comparison.similarRuns),
            metricBlock("Best prior membrane", comparison.bestMembrane),
            metricBlock("Best prior blocker", comparison.bestBlocker),
            metricBlock("Best prior transfer", comparison.bestTransfer),
            h(
              "div",
              { className: "recommendation-card comparison-card-wide" },
              h("h3", null, "What history suggests"),
              h("ul", null, comparison.insights.map((item, index) => h("li", { key: index }, item)))
            )
          )
        : h("div", { className: "empty-state" }, "Save a few runs for the same or related protein and Butterfly can compare what changed and what improved.")
    );
  }

  function FinalIntegritySection({ number, finalAnalysis, preview, integrity, onUpload }) {
    return h(
      SectionCard,
      { number, title: "Final Image Integrity Review", subtitle: "The final blot image is the critical certification step before quantification, sharing, or interpretation." },
      h(
        "div",
        { className: "upload-card" },
        h("label", null, "Upload final blot image"),
        h("input", { type: "file", accept: "image/*", onChange: (event) => onUpload("final", event.target.files && event.target.files[0]) }),
        preview ? h("img", { src: preview, className: "preview", alt: "Final blot preview" }) : null
      ),
      finalAnalysis
        ? h("div", { className: "metric-grid" }, Object.keys(metricLabels).filter((key) => finalAnalysis[key] !== undefined).map((key) => h("div", { className: "metric-card", key }, h("p", { className: "metric-label" }, metricLabels[key]), h("p", { className: "metric-value" }, key.includes("pct") ? `${finalAnalysis[key]}%` : String(finalAnalysis[key])))))
        : h("div", { className: "empty-state" }, "Upload the final blot when you want Butterfly to run its integrity screen."),
      integrity ? h(RecommendationCard, { title: "Integrity review", recommendation: integrity }) : null
    );
  }

  function ProteinIntelligencePane({ proteinIntelligence }) {
    const counts = proteinIntelligence.ebi_features?.counts || {};
    const examples = proteinIntelligence.ebi_features?.examples || [];
    return h(
      "div",
      { className: "intel-results" },
      h("div", { className: "metric-grid" }, metricBlock("Accession", proteinIntelligence.resolved_accession || "Not resolved"), metricBlock("Predicted pI", proteinIntelligence.chemistry?.theoretical_pI ?? "n/a"), metricBlock("MW (kDa)", proteinIntelligence.chemistry?.molecular_weight_kda ?? "n/a"), metricBlock("AlphaFold pLDDT", proteinIntelligence.alphafold?.mean_plddt ?? "n/a"), metricBlock("Membrane retention risk", proteinIntelligence.chemistry?.membrane_retention_risk ?? "n/a"), metricBlock("Aggregation risk", proteinIntelligence.chemistry?.aggregation_risk ?? "n/a")),
      h("p", { className: "tiny-label" }, "Protein features"),
      h("div", { className: "tag-row" }, tag(`TM ${counts.TRANSMEM || 0}`), tag(`Hydrophobic domains ${proteinIntelligence.chemistry?.hydrophobic_domain_count ?? 0}`), tag(`Longest hydrophobic run ${proteinIntelligence.chemistry?.longest_hydrophobic_run ?? 0}`), tag(`Cleavage/processing ${proteinIntelligence.chemistry?.cleavage_site_count ?? 0}`), tag(`Signal ${counts.SIGNAL || 0}`), tag(`Domains ${counts.DOMAIN || 0}`), tag(`DNA bind ${counts.DNA_BIND || 0}`)),
      h("p", { className: "tiny-label" }, "Predictive interpretation"),
      h("ul", null, (proteinIntelligence.predictions || []).map((item, index) => h("li", { key: index }, item))),
      h("p", { className: "tiny-label" }, "Buffer and chemistry guidance"),
      h("ul", null, (proteinIntelligence.buffer_recommendations || []).map((item, index) => h("li", { key: index }, item))),
      examples.length ? h(React.Fragment, null, h("p", { className: "tiny-label" }, "Feature examples"), h("ul", null, examples.map((item, index) => h("li", { key: index }, `${item.type} ${item.begin || "?"}-${item.end || "?"} ${item.description || ""}`.trim())))) : null
    );
  }

  function ChemistrySummaryCard({ proteinIntelligence }) {
    const chemistry = proteinIntelligence.chemistry || {};
    return h(
      "div",
      { className: "comparison-grid" },
      metricBlock("Theoretical pI", chemistry.theoretical_pI ?? "n/a"),
      metricBlock("Hydrophobic fraction", chemistry.hydrophobic_fraction ?? "n/a"),
      metricBlock("Hydrophobic domains", chemistry.hydrophobic_domain_count ?? "0"),
      metricBlock("Aggregation risk", chemistry.aggregation_risk ?? "n/a")
    );
  }

  function SuggestedStepsCard({ recommendation }) {
    return h(
      "div",
      { className: "recommendation-card comparison-card-wide" },
      h("h3", null, "Suggested starting steps"),
      h(
        "ol",
        { className: "steps-list" },
        recommendation.actions.slice(0, 6).map((item, index) => h("li", { key: index }, item))
      )
    );
  }

  function RecommendationCard({ title, recommendation }) {
    const scoreClass = recommendation.score >= 0.75 ? "score-good" : recommendation.score >= 0.5 ? "score-warn" : "score-bad";
    return h("div", { className: "recommendation-card" }, h("h3", null, title), h("p", { className: "status mono-copy" }, recommendation.summary), h("div", { className: `score-pill ${scoreClass}` }, `Confidence ${Math.round(recommendation.score * 100)}%`), h("p", { className: "tiny-label" }, "Why Butterfly thinks this"), h("ul", null, recommendation.rationale.map((item, index) => h("li", { key: index }, item))), h("p", { className: "tiny-label" }, "Next actions"), h("ul", null, recommendation.actions.map((item, index) => h("li", { key: index }, item))));
  }

  function ImagePanelMini({ title, stage, analysis, preview, onUpload }) {
    return h(
      "div",
      { className: "upload-card" },
      h("label", null, title),
      h("input", { type: "file", accept: "image/*", onChange: (event) => onUpload(stage, event.target.files && event.target.files[0]) }),
      preview ? h("img", { src: preview, className: "preview preview-mini", alt: `${stage} preview` }) : null,
      analysis ? h("div", { className: "tiny-label" }, `Contrast ${analysis.contrast} • Saturation ${analysis.saturation_pct}%`) : h("div", { className: "tiny-label" }, "Optional supporting evidence")
    );
  }

  function HistoryPanel({ number, history, selectedId, onLoad }) {
    return h(
      "aside",
      { className: "stack" },
      h(
        SectionCard,
        { number, title: "Experiment History", subtitle: "Saved runs become Butterfly’s internal evidence base." },
        history.length
          ? h("div", { className: "history-stack" }, history.map((item) => h("div", { className: "history-item", key: item.id }, h("h3", null, item.title), h("div", { className: "history-meta mono-copy" }, `Experiment #${item.id} • updated ${formatDate(item.updated_at)}`), h("div", { className: "tag-row" }, buildTags(item.payload).map((itemTag) => h("span", { className: "tag", key: itemTag }, itemTag))), h("div", { className: "button-row" }, h("button", { className: item.id === selectedId ? "button button-secondary" : "button button-ghost", type: "button", onClick: () => onLoad(item) }, item.id === selectedId ? "Loaded" : "Load")))))
          : h("div", { className: "empty-state" }, "No saved experiments yet.")
      )
    );
  }

  function SectionCard({ number, title, subtitle, children }) {
    return h("section", { className: "panel panel-active" }, h("div", { className: "panel-header" }, h("div", { className: "panel-index" }, number || title.charAt(0)), h("div", null, h("h2", null, title), h("div", { className: "panel-copy" }, subtitle))), children);
  }

  function FieldGroup({ title, copy, children }) {
    return h(
      "div",
      { className: "field-group" },
      h("div", { className: "field-group-header" }, h("h3", null, title), copy ? h("p", null, copy) : null),
      h("div", { className: "field-group-grid" }, children)
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

  function buildImageEvidenceSummary(analyses) {
    const available = Object.keys(analyses || {}).filter((stage) => analyses[stage]);
    if (!available.length) {
      return {
        title: "No image evidence uploaded yet.",
        copy:
          "Troubleshooting will still work from the symptom and method fields, but it becomes more adaptive if the Experiment Log includes gel, transfer, or final blot images.",
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
