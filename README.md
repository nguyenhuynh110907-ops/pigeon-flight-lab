# Pigeon Flight Lab

**An exploratory agent-based simulator of pigeon flocks encountering a civil aircraft.**

Version **2.0.0** · Vanilla JavaScript · No external runtime dependencies · Vietnamese interface

[Hướng dẫn tiếng Việt](README.vi.md) · [Model notes](README.vi.md#phương-trình-và-phạm-vi) · [MIT license](LICENSE)

Explore how initial geometry, climb/descent, delayed reactions, flock coordination and hypothetical sensory cues affect a simulated encounter. The implementation separates published reference values, idealized physical equations and adjustable behavioral assumptions.

> **Research prototype.** This simulator has not been calibrated against pigeon–aircraft encounters. Geometric contacts and forecast errors are simulation outputs, not real-world bird-strike probabilities or validated deterrent effectiveness. It is not an operational aviation decision tool.

![Motion forecast and sensory controls in Pigeon Flight Lab](docs/preview.jpg)

## Run locally

Download the repository and open **`dist/Bo-cau-lab.html`** in a modern browser. This standalone file works offline; no installation is needed.

Alternatively, run one of the following from the repository directory:

```bash
# Python 3; opens the browser automatically
python3 start-local.py

# Or Node.js 18+
node server.mjs
```

Then visit **http://localhost:4173/**. On Windows, use `py -3 start-local.py` or `START-WINDOWS.bat`. A `START-MAC.command` launcher is also included. Keep the server terminal open and press Ctrl+C to stop it. No `npm install` is required.

## What you can investigate

| Component | Implemented behavior |
| --- | --- |
| Encounter geometry | Force a nominal aircraft–flock-centroid intersection under unchanged initial velocities, or vary lateral/vertical separation. |
| Flight phase | Final approach, climb after liftoff, level flight, or a manually selected vertical rate. Altitude changes during the encounter. |
| Flock dynamics | Seeded individual variation, alignment, cohesion, separation, neighbor warnings and acceleration-limited escape. |
| Aircraft contacts | Swept relative-motion checks against six simplified aircraft boxes, with a bird-size margin. |
| Sound | A moving single-frequency point source, propagation delay, Doppler shift, free-field attenuation and explicit hearing/noise criteria. |
| Light | Wavelength, radiant intensity, pulse rate, inverse-square irradiance and photon flux. |
| Predator | A separate robotic-falcon agent pursuing the nearest bird; a simplified scenario inspired by published pigeon work. |
| Prediction | Constant-velocity (CV) forecasts, closest approach, selected escape directions, an acceleration-based envelope and within-simulation RMSE. |
| Research outputs | Per-bird CSV plus JSON events and a 0.2-second centroid/aircraft trace. |

The **measurement-only** mode records sound/light levels without changing bird behavior. A separate, explicitly hypothetical switch connects threshold crossing to the start of an escape response. A pure tone or screen color is not treated as a recognized predator call or image.

## Suggested experiments

1. Start with the landing or takeoff preset. Keep the random seed fixed while comparing parameters.
2. Use the unchanged-velocity control to verify the nominal centroid intersection. The centroid can be empty; intersecting it does not imply hitting every bird.
3. Compare sensory measurement-only mode with the hypothetical response mode using identical signal settings.
4. Change detection distance, response delay or forecast horizon. Observe how turning changes the forecast error and closest approach.
5. Export results. The CSV and JSON identify whether the run is complete and whether its initial geometry is valid.

The aircraft follows its selected straight trajectory; it does not chase the moving flock centroid. Initial geometry is adjusted to create the nominal encounter. Invalid initial positions below the model's ground limit are blocked.

## Evidence and assumptions

| Reference | Use in this project |
| --- | --- |
| [Papadopoulou et al. (2022), HoPE](https://doi.org/10.1371/journal.pcbi.1009772) | Published model references: 16 m/s cruise speed, preferred-speed variation, seven topological neighbors, 1 m separation and a 215° interaction window. This custom 3D model does not reproduce or inherit the validation of HoPE. |
| [Heffner et al. (2013)](https://doi.org/10.3758/s13428-012-0269-y) | Pigeon hearing reference points. Hearing a signal is distinct from fearing it or avoiding an aircraft. |
| [Woronecki (1988), USDA](https://digitalcommons.unl.edu/vpcthirteen/54/) | A pigeon deterrent trial that does not support guaranteed, sustained effectiveness of the tested devices. |
| [Nebel et al. (2019)](https://doi.org/10.1098/rsos.190677) | Qualitative context for slower pigeon responses to a simulated hawk in darker conditions. No fixed aircraft-light response delay is inferred. |
| [High-contrast lights study (2018)](https://pubmed.ncbi.nlm.nih.gov/30280013/) | Tested on brown-headed cowbirds, not pigeons; color-specific effectiveness is not transferred to this model. |
| [FAA AIM, ILS](https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html) | A typical 3° glidepath informs the landing default. Climb angle and speed remain user-selected scenarios. |
| [FAA Wildlife FAQ](https://www.faa.gov/airports/airport_safety/wildlife/faq) | Reported strike altitude and seasonal context across bird species, not a pigeon-specific risk function. |
| [Airbus A320 characteristics](https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2025-01/AC_A320_0624.pdf) | Overall length and wingspan only; component boxes are simplified. |
| [OSHA Technical Manual](https://www.osha.gov/otm/section-3-health-hazards/chapter-5) | Ideal free-field attenuation for a point sound source. |

Detection distance **220 m**, delay **0.6 s**, acceleration limit **12 m/s²**, neighbor-warning delay **0.15 s**, source levels, masking margin, light threshold and force weights are **exploratory defaults**, not measured pigeon–airliner response parameters. Source references and fuller equations are available in the interface and [Vietnamese documentation](README.vi.md).

CV forecasts use `p(t + H) = p(t) + v(t)H`. RMSE compares those forecasts with subsequent **simulated** positions. The radius `0.5 * a_max * H²` is an assumed kinematic bound for unchanged flock membership away from the ground, not a statistical confidence interval.

The model omits wind, visual occlusion, engine ingestion, wake turbulence, aircraft/pilot avoidance, damage and the probability of encountering birds. Aircraft boxes do not rotate during climb/descent. No empirical seasonal multiplier is applied.

## Development and checks

```bash
# Run the 14 model and sensor tests
node --test tests/*.test.mjs

# Rebuild the self-contained HTML after editing source
node build.mjs
```

The tests cover units and closest approach, continuous collision geometry, repeatability, flight-phase geometry, response latency, ground limits, sensory-mode independence, causal sound propagation, Doppler, irradiance and prospective forecast error. They validate the implementation's stated rules, not its biological accuracy.

| File | Purpose |
| --- | --- |
| `dist/model.mjs` | Agent model, encounter geometry, prediction and seeded variation. |
| `dist/sensors.mjs` | Sound/light physics and hearing-reference logic. |
| `dist/app.mjs` | Controls, canvas views, exports and optional audio sample. |
| `dist/index.html`, `dist/style.css` | Vietnamese interface and scientific references. |
| `dist/Bo-cau-lab.html` | Generated standalone application, committed for convenient offline use. |
| `tests/` | Model and sensor checks using Node's built-in test runner. |
| `build.mjs`, `server.mjs`, `start-local.py` | Dependency-free build and local launchers. |

The optional WebMCP interface is feature-detected; ordinary use does not depend on browser support for it. The application sends no experiment data to a server.

## Next research steps

- Calibrate detection, latency and turning distributions against suitable trajectory data.
- Run sensitivity studies across seeds and geometries before interpreting scenario differences.
- Evaluate sensory hypotheses with species-specific experimental evidence, including habituation and environmental masking.

## License and provenance

Original project code and documentation are provided under the [MIT license](LICENSE). Linked papers, datasets and manufacturer documents retain their own terms; they are cited rather than bundled. Development used AI-assisted coding and literature synthesis. This repository makes no claim of affiliation with the cited researchers, FAA, Airbus or Kent State University.
