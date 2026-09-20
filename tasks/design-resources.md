# Design resources — filtered for PREMIUM

Captured 20 Sep 2026. The web app is days 12–18, so this is a parking lot, not a
plan. Filtered against the anti-slop design law rather than reproduced verbatim.

**The surface we actually build:** one-click underwrite (NO), positions + claims,
public risk price with an embeddable endpoint, status page. That is four screens
and roughly six components. Most of a component library is dead weight against it.

---

## Use

| Resource | For what |
|---|---|
| **shadcn/ui** · ui.shadcn.com | Accessible primitives — dialog, tabs, form, table. Take the behaviour, throw away the styling. Already in the standing toolkit |
| **Motion** · motion.dev | The animation engine. Already the planned dependency. Do not add a second one |
| **Motion Primitives** · motion-primitives.com | Tailwind + Motion patterns. We have Tailwind v4, so these apply directly |
| **Component Gallery** · component.gallery | 2,600 examples of how real design systems solve one element. Reference, not code — the highest-value item on the list |
| **Refero Styles** · styles.refero.design | Real product styles with typography. Useful for picking a type voice that is not off the Google shelf |
| **DESIGNmd** · designmd.ai | Design systems as markdown for an agent to consume |
| **Kage** · kage.design | UI inspiration mapped to prompts. **An MCP connector is already available in-session** (`mcp__claude_ai_Kage__authenticate`) |
| **Footer Design** · footer.design | The footer is a named slop risk. Worth one look before building ours |

## Use only stripped

These ship the exact defaults the design law rejects. Behaviour yes, styling no.

| Resource | What it will try to give you |
|---|---|
| **Aceternity UI** · ui.aceternity.com | Background beams, glowy gradient buttons, floating cards, gradient headline text. Nearly its whole catalogue is on the reject list |
| **Magic UI** · magicui.design | Same family. Marketing-site slop defaults, blue-to-purple throughout |
| **Uiverse** · uiverse.io | Thousands of community CSS toys, largely untyped, wildly inconsistent. Quality floor is very low |
| **Gradient Buttons** · gradientbuttons.colorion.co | A gradient button is the single most recognisable machine-made element there is |
| **Liquid Glass** · glass.samasante.com | Glass is premium only when flawless. Over our surfaces there is nothing worth refracting, so it would be decoration |

## Skip for this project

- **Anime.js** — we have Motion. Two animation libraries is a bundle cost and a
  consistency risk for zero gain.
- **mapcn** — no maps.
- **AppShot / Navbar galleries, 404s, Circle Loaders, MicroKit, CSS Text Effects,
  3Dicons, Kitbitz** — inspiration for surfaces we do not have. Revisit only if a
  specific screen needs one.
- **Scrolltide, VibePrompt, OpenMotion, Kinetics, 21st.dev, UIAble, Minimal Gallery** —
  scrollytelling and marketing-page tooling. PREMIUM's UI is a financial control
  surface: a borrower reading a price and signing once. Scroll storytelling is the
  wrong genre and would actively hurt trust.

---

## The rule that governs all of it

A prebuilt block is a head start, not a free pass. Take the accessible behaviour,
discard the generic styling, and run the result through the design law exactly like
hand-written work. Slop is not acceptable because it arrived pre-made.

And the harder constraint: this product asks someone to sign a transaction with real
USDC against a risk they are frightened of. It should read as **instrument, not
landing page** — closer to a trading terminal or a policy document than to a startup
homepage. Most of the list above optimises for the opposite.
