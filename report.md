I’ll go through the final brief section by section and unpack **what each part
is doing, why it’s there, and how the numbers were obtained**. Think of this as
the “annotated version” of your report.

---

## 0. Student Cover Page

### Purpose

The assignment explicitly mentions a “Student Cover Page” to summarize the key
design parameters. This is essentially a one-screen snapshot for the reviewer:
they can see in 10 seconds what you designed without digging into details.

### What each field means and how it was chosen

- **Roadway Type – Urban Expressway Divided (UED-410.4-80)** This is your
  functional and geometric classification:
  - Urban
  - Divided
  - Expressway
  - 4 lanes (2 per direction)
  - Design speed 80 km/h This matches the problem statement: 4-lane divided,
    urban, high volume (~30k veh/day), with signalized intersections outside
    your segment.

- **Design Speed – 80 km/h** For UED in an urban setting, 80 km/h is a typical,
  defensible speed. It is fast enough for mobility but not as high as a freeway
  (100+).

- **Radius of Horizontal Curve – 300 m** The Alberta guide gives a **minimum
  radius** for this class and speed (≈ 250 m). You deliberately chose something
  **larger than minimum** (300 m) to:
  - Increase comfort
  - Slightly reduce lateral acceleration
  - Simplify superelevation and stopping sight distance issues

- **Horizontal Curve Length – 375.2 m** This is the **arc length** of the
  circular curve, computed from: [ L = \frac{\pi R \Delta}{180} ] where (R
  = 300) m and (\Delta = 71.6^\circ).

- **Superelevation – 6%** The theoretical superelevation needed for 80 km/h and
  300 m radius is 16.8% (too high), so you cap it at the **maximum allowed** by
  the AB guideline for this road type: 6%.

- **Superelevation Runoff – 22.2 m** This is how much length along the tangent
  (or partially along the curve) you need to go from 2% crown to full 6%
  superelevation across both lanes. You computed it using a standard runoff
  formula per lane, then doubled it for two lanes.

- **Vertical Curve Type – Crest** You are going uphill then flattening out;
  driver’s line of sight is limited by the **road crest**, so this is a crest
  curve.

- **Vertical Curve K – 45** K is (L/A), where (L) is length and (A) is the
  algebraic difference in grade (in %). K ≈ 45 is consistent with stopping sight
  distance requirements for an 80 km/h crest curve in the Guide.

- **Vertical Curve Length – 120 m** With K = 45 and A = 6%, [ L = K \cdot A = 45
  \times 0.06 = 120\ \text{m} ] That’s a realistic crest length for this speed.

- **Top-of-Hill Station – 6+201.6** This is the final chainage of the top point
  as measured from station 0 somewhere far behind. It must be consistent with
  all your tangent and curve lengths.

---

## 1. Introduction

### Purpose

This section tells the reader in a few sentences:

- What you are doing: designing a **combination of horizontal and vertical
  curves** between two fixed points.
- Under which standard: **Alberta Transportation Highway Geometric Design
  Guide**.
- In what context: first-draft engineering concept, to be discussed in a
  meeting.

### Why it matters

Markers want to see that you understand this is not just arbitrary math: you’re
performing a **geometric design task** under **real standards** with a clear end
use (technical meeting).

---

## 2. Input Geometry

This section is simply a cleaned-up restatement of the assignment’s given
geometry.

### Coordinates

- Bottom of Hill: (E = 0, N = 200)
- Top of Hill: (E = 600, N = 830)

This defines your **plan geometry**: where these points are in a local grid. All
your horizontal stationing is along the centerline connecting these.

### Elevations

- 200 m at the bottom, 235 m at the top → total rise = 35 m. This is crucial
  because your **vertical design** must produce this exact elevation change.

### Grades & Angles

- Bottom grade: –1% (the existing tangent at the bottom is sloping downward as
  you move north-east).
- Top grade: 0% (flat).
- Bottom tangent direction: 18.4° CCW from North
- Top tangent direction: 90° CCW from North (due East)

These angles are used to compute the **deflection angle** and the orientation of
the tangents.

### Station

- Starting station = 5+200. This is an arbitrary reference used in the problem.
  All stations are measured along your alignment forward from this.

---

## 3. Roadway Design Designation

### What is a designation?

The AB Guide uses classifications like **URD**, **UAD**, **UED**, etc., which
package together:

- Functional role (local, collector, arterial, expressway)
- Divided/undivided
- Urban/rural
- Typical lanes, lane widths, speed, and geometric standards (R, K, e_max, etc.)

### Why UED-410.4-80?

Given:

- Urban location
- Divided highway
- 4 lanes (2 + 2)
- 30,000 veh/day

This fits an **Urban Expressway Divided** type. The “410.4-80” code embeds lane
count, median type, and design speed. Choosing a concrete designation:

- Pins down **design speed** to 80 km/h
- Tells you which tables in the AB Guide to use for:
  - Minimum radius
  - Superelevation
  - K-values for vertical curves
  - Sight distances

So this section signals to the grader: you have tied your choices to a
**standard class** in the AB Guide, not just guessed.

---

## 4. Horizontal Alignment

### 4.1 Deflection Angle

You compute how much one tangent must “turn” to match the other.

- Tangent 1 direction: 18.4°
- Tangent 2 direction: 90°
- Deflection angle: [ \Delta = 90^\circ - 18.4^\circ = 71.6^\circ ]

This Δ is the **central angle** of your circular curve. All standard horizontal
curve formulas use R and Δ.

---

### 4.2 Curve Radius

From the Guide (via the designation and speed), you know:

- Minimum radius for UED-80 is around 250 m (assuming some friction and
  superelevation).

You choose:

[ R = 300\ \text{m} ]

Why 300 m?

- Slightly larger than minimum → safer and more comfortable.
- Makes superelevation and SSD easier to satisfy.
- Still realistic in an urban setting.

---

### 4.3 Curve Elements (Tangent length T and curve length L)

Using basic circular curve relationships:

- Tangent length: [ T = R \tan(\Delta/2) = 300 \tan(35.8^\circ) = 216.6\
  \text{m} ]

This is the distance from PI to PC (and from PI to PT).

- Curve length: [ L = \frac{\pi R \Delta}{180} = \frac{\pi \cdot 300 \cdot
  71.6}{180} = 375.2\ \text{m} ]

This is the **arc length** of the circular curve between PC and PT.

These values are used for both **plan coordinates** (projecting tangents and
curve) and **stationing** (PC, PI, PT).

---

### 4.4 Superelevation

This is where you show you know **lateral safety**.

1. **Theoretical superelevation requirement** Use the standard highway formula
   for horizontal curve design: [ e + f = \frac{V^2}{127R} ] If you assume the
   friction term is small or focus just on e for check, the superelevation-only
   term is: [ e = \frac{V^2}{127 R} ] With:
   - (V = 80\ \text{km/h})
   - (R = 300\ \text{m}) [ e = \frac{80^2}{127\cdot 300} = \frac{6400}{38100}
     \approx 0.168 = 16.8% ]

   This is what you’d need if you relied heavily on superelevation.

2. **Check against AB Guide maximum** The AB Guide limits superelevation to
   about **6%** for this road class (to control drainage, vehicle stability,
   constructability).

   So your design must respect: [ e \le 0.06 ]

   You pick: [ e_{\text{design}} = 6% ]

   The rest of the centripetal balance comes from **side friction** and
   conservative speed assumptions, which is standard practice.

---

### 4.5 Superelevation Runoff

Runoff is the length required to **transition crossfall** from:

- Normal crown (e.g., 2% down each side)
- To full superelevation (6% cross-slope on the inside lane)

A simple approximate formula: [ L_r = \frac{w e}{\Delta} ]

Where:

- (w = 3.7\ \text{m}) (lane width)
- (e = 0.06)
- (\Delta = 0.02) (maximum allowed relative gradient for crossfall change)

Per lane: [ L_r = \frac{3.7 \cdot 0.06}{0.02} = 11.1\ \text{m} ]

For two lanes: [ L_{runoff,total} = 2 \times 11.1 = 22.2\ \text{m} ]

Interpretation:

- Over approx 22 m of roadway, your cross-slope transitions from normal crown to
  full 6% superelevation.
- You need to locate this runoff on the tangents and/or partially on the curve,
  per guideline recommendations.

This section satisfies the assignment requirement: _“if you select a curve that
requires superelevation then you should account for the runoff distance
required.”_

---

### 4.6 Horizontal Coordinates & Stations

You:

1. Use vector geometry from the bottom point with the bottom tangent direction
   to find the PI, then back along the tangent by T to get PC, and forward along
   the top tangent direction by T to get PT.
2. Project along your alignment to compute station distances from 5+200.

Result stations:

| Point | Station |
| ----- | ------- |
| PC    | 5+652.8 |
| PI    | 5+869.4 |
| PT    | 6+028.0 |
| Top   | 6+201.6 |

This ensures **internal consistency**: bottom to PC plus L to PT plus tangent to
top = total alignment length.

---

## 5. Vertical Alignment

### Core problem

You must raise the road by **35 m** from bottom to top, but:

- The original bottom grade is –1% (which _loses_ elevation)
- The top grade is 0% (flat)

If you tried a vertical curve directly between –1% and 0% over your ~1 km
horizontal distance, the net elevation change would be far less than 35 m. So:

- One vertical curve with the existing grades is **physically incapable** of
  matching the required 35 m rise.

### Design approach

You introduce:

1. A long **uphill tangent** at +6% (within typical max grade for an urban
   expressway).
2. A **crest vertical curve** from +6% to 0% to smoothly transition to the top
   tangential grade.

---

### 5.1 Vertical Curve Parameters

You design a crest curve based on:

- Initial grade (G_1 = +6%)
- Final grade (G_2 = 0%)
- A = |G1 – G2| = 6%

From the AB Guide K-values table for 80 km/h crest curves, K ≈ 45 is suitable
for SSD.

Then: [ L = K \cdot A = 45 \times 0.06 = 120\ \text{m} ]

This gives a **realistic** crest curve: long enough for sight distance, short
enough to fit within your 1 km segment.

---

### 5.2 Tangent Length Calculation

You split the total 35 m rise into:

- Rise provided by the uphill tangent
- Rise provided by the crest curve

Vertical curve contribution:

For an equal-tangent vertical curve, the net rise from PVC to PVT is: [ \Delta
h_{vc} = \frac{G_1 + G_2}{2} \cdot \frac{L}{100} ] (in grade percent/100, length
in m)

So: [ \Delta h_{vc} = \frac{6 + 0}{2} \cdot \frac{120}{100} = 3% \cdot 1.2\
\text{m/m} = 3.6\ \text{m} ]

Remaining rise needed from tangent: [ 35 - 3.6 = 31.4\ \text{m} ]

At +6%: [ L_t = \frac{31.4}{0.06} = 523.3\ \text{m} ]

This is the length of the **uphill tangent** before the PVC.

---

### 5.3 Stations and Elevations

Starting station = 5200 (Bottom).

- PVC station: [ 5200 + 523.3 = 5723.3\ \text{m} ]

- PVI station: [ PVC + \frac{L}{2} = 5723.3 + 60 = 5783.3\ \text{m} ]

- PVT station: [ PVI + 60 = 5843.3\ \text{m} ]

**PVC elevation**: [ e_{PVC} = 200 + G_1 \cdot L_t = 200 + 0.06 \cdot 523.3 =
231.4\ \text{m} ]

**PVI elevation** (intersection of tangents):

- Move 60 m along the 6% tangent from PVC: [ e_{PVI} = e_{PVC} + 0.06 \cdot 60 =
  231.4 + 3.6 = 235.0\ \text{m} ]

**PVT elevation** (on 0% tangent from PVI):

- Grade 0% from PVI to PVT: [ e_{PVT} = e_{PVI} + 0 \cdot 60 = 235.0\ \text{m} ]

So PVC = 231.4 m, PVI = 235.0 m, PVT = 235.0 m. The **curve itself** lies
slightly below the PVI (since it is a crest), but the assignment only needs PVI,
PVC, PVT elevations.

From PVT at 235 m, the 0% grade continues to the top of hill, also at 235 m, so
everything matches.

---

## 6. Final Combined Alignment

You now check:

- Horizontally: bottom → PC → PT → top yields total station 6+201.6.
- Vertically: bottom at 5200 is 200 m; 523.3 m later at 5723.3 you have 231.4 m,
  then 120 m crest to 5843.3 gets you to 235 m, then 0% to 6201.6 maintains 235
  m.

Everything is consistent:

- The horizontal distance and vertical design **use the same chainage**.
- No contradictions between geometry and elevations.

---

## 7. Sketches (Plan & Profile)

These are simple schematic drawings that show:

- **Plan view**: where the road bends in the horizontal plane.
- **Profile view**: how the elevation changes along the station line.

They don’t need to be perfectly to scale for this assignment, but they must:

- Show the relative positions of Bottom, PC, PI, PT, top.
- Show the crest curve section in the vertical profile.
- Reflect stations consistent with your tables.

---

## 8. Design Change Explanation

This section satisfies a rubric requirement: you must describe one **design
change** you had to make and why.

The narrative:

- Initial idea: one vertical curve using the given –1% and 0% grades.
- Problem: insufficient elevation gain to reach top (235 m).
- Fix: introduce a **+6% uphill tangent** followed by a **120 m crest curve**.

This shows real engineering thinking: you identified a **constraint violation**
and modified the design accordingly, rather than forcing numbers.

---

## 9. Recommendation for Future Iterations

This is your “if we had more time or scope” statement. It shows awareness that:

- Real designs may further refine speed, radii, superelevation, and transitions.
- Things like spirals, 2-curve layouts, or more conservative speeds might be
  better in practice.

You’re essentially saying: “This is a solid first draft; if we continued, here’s
what I’d optimize.”

---

## 10. Conclusion

This section confirms:

- All geometric parameters are internally consistent.
- Requirements from the assignment are met:
  - Roadway designation
  - Horizontal curve (R, Δ, PC/PI/PT coordinates & stations)
  - Vertical curve (type, K, PVC/PVI/PVT stations & elevations)
  - Superelevation and runoff
  - Top-of-hill station
  - Sketches
  - Design change + recommendation

You’ve closed the loop between **problem statement → design → verification**.

---

If you want, next I can:

- Turn this into **speaker notes for your 5-minute presentation**, or
- Walk you through **how to do each calculation manually** so you can re-derive
  everything under exam conditions.
