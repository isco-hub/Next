export const SEED_NOW_ISO = "2026-11-14T08:00:00.000Z";

export const SAMPLE_RULE_PACK_YAML = `# NextCrop rule pack v2.0 — reviewed by agronomist, Sprint 2.
# Two-person publish required. MFA step-up on publish.
version: 2.0.0
region: Lango
seasons: [A, B]

lookup:
  previous_crop:
    maize:
      restore_soil: [soya, groundnut, cowpea]
      max_cash: [simsim, sunflower, soya]
      drought_survival: [sorghum, finger_millet, simsim]
    sorghum:
      restore_soil: [groundnut, cowpea, soya]
      max_cash: [soya, simsim, maize]
      drought_survival: [simsim, finger_millet]
    groundnut:
      restore_soil: [maize, sorghum, finger_millet]
      max_cash: [maize, simsim, sunflower]
      drought_survival: [sorghum, finger_millet]
    cassava:
      restore_soil: [cowpea, soya, groundnut]
      max_cash: [maize, groundnut, soya]
      drought_survival: [sorghum, finger_millet]
    soya:
      restore_soil: [maize, sorghum, finger_millet]
      max_cash: [maize, simsim, sunflower]
      drought_survival: [sorghum, finger_millet]
    bean:
      restore_soil: [maize, sorghum]
      max_cash: [maize, simsim]
      drought_survival: [sorghum, cowpea]
    cowpea:
      restore_soil: [maize, sorghum]
      max_cash: [maize, simsim]
      drought_survival: [sorghum, finger_millet]
    simsim:
      restore_soil: [cowpea, soya, groundnut]
      max_cash: [maize, groundnut]
      drought_survival: [sorghum, cowpea]
    sunflower:
      restore_soil: [cowpea, soya]
      max_cash: [maize, groundnut]
      drought_survival: [sorghum, finger_millet]
    finger_millet:
      restore_soil: [soya, groundnut, cowpea]
      max_cash: [simsim, soya]
      drought_survival: [sorghum, cowpea]

season_gate:
  maize: {A: best, B: conditional}
  sorghum: {A: good, B: good}
  finger_millet: {A: good, B: good}
  soya: {A: good, B: good}
  groundnut: {A: best, B: conditional}
  bean: {A: conditional, B: best}
  cowpea: {A: good, B: good}
  simsim: {A: risky, B: best}
  sunflower: {A: good, B: good}
  cassava: {A: good, B: good}

hard_rules:
  - id: HR-01
    rule: No same crop in consecutive seasons.
  - id: HR-02
    rule: Striga present; exclude cereals for at least two seasons.
  - id: HR-03
    rule: Sunflower returns only after at least two seasons.
  - id: HR-04
    rule: Cassava disease; exclude cassava.
  - id: HR-05
    rule: Clay soil; exclude simsim and cassava.
  - id: HR-06
    rule: Wet season; exclude simsim and warn for groundnut and bean.
  - id: HR-07
    rule: Dry Season A; exclude maize.
  - id: HR-08
    rule: Groundnut disease history; exclude groundnut for two seasons.
  - id: HR-09
    rule: Cassava is a locked block of at least two seasons.

scoring:
  legume_after_cereal: +12
  cereal_after_legume: +8
  drought_tolerant_bonus: +9
  cash_crop_bonus: +6
  low_fertility_legume: +8
  striga_cowpea: +6
  striga_soya: +4
  armyworm_maize_penalty: -8
  same_family_penalty: -8
  season_best: +8
  season_good: +3
  season_conditional: -12

golden_tests:
  - GT-01
  - GT-02
  - GT-03
  - GT-04
  - GT-05
  - GT-06
  - GT-07
  - GT-08
  - GT-09
  - GT-10
  - GT-11
  - GT-12
`;

export const DRAFT_RULE_PACK_YAML = SAMPLE_RULE_PACK_YAML.replace(
  "version: 2.0.0",
  "version: 2.1.0",
)
  .replace("drought_tolerant_bonus: +9", "drought_tolerant_bonus: +11");

export const OFFICER_CONTACT =
  "Contact your extension officer at the sub-county agriculture office.";

export const SAMPLE_DISCLAIMER =
  "This plan uses regional climate data and agronomy rules. It does not measure your field. Check with your extension officer before planting.";
