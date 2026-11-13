The latest 12 sample rider portraits are the first portrait direction I want to approve as the basis for Pelotonia.
Preserve this overall visual style:
-  semi-realistic illustrated professional athletes 
-  modern premium game-art appearance 
-  slightly stylized/cartooned, but not childish or caricatured 
-  characters should feel serious enough to be professional athletes, but distinctive and likeable enough that players can form attachments to them over long careers 
-  expressive, clearly visible eyes 
-  believable facial anatomy 
-  chest/upper-torso composition 
-  consistent camera angle, framing and lighting 
-  no helmets 
-  no sunglasses or glasses 
-  clean enough to remain readable at small rider-card sizes 
The latest samples are a style reference, not a fixed set of faces.
The final system may eventually contain tens or hundreds of thousands of riders. They must not begin to look like minor variations of the same 10–20 templates.
Variation should include at minimum:
-  overall face shape 
-  skull/head proportions 
-  jaw 
-  chin 
-  cheekbones 
-  nose shape and size 
-  eye shape 
-  eye size 
-  eye colour 
-  eyebrow shape/thickness 
-  mouth 
-  lip shape/thickness 
-  ears 
-  skin tone 
-  freckles 
-  moles and other subtle skin details 
-  age characteristics 
-  hair texture 
-  hairstyle 
-  hair length 
-  hair colour 
-  hairline 
-  baldness 
-  facial hair for appropriate male riders 
-  body/shoulder build 
-  subtle facial expression 
There should be equally rich variation for female and male riders.
Female riders must not simply be male facial templates with different hair. Both populations need broad, believable independent variation while remaining in exactly the same Pelotonia art style.
Most generated riders should look like plausible ordinary professional athletes.
Distinctive traits should exist, but should be statistically uncommon.
Examples:
-  bald 
-  shaved head 
-  mohawk 
-  unusual hairstyle 
-  unusually long hair 
-  unusual hair colour 
-  striking beard 
-  very prominent freckles 
-  unusual facial structure 
A purple mohawk is interesting because perhaps one rider in hundreds has one. It should not become routine.
Build generation probabilities accordingly if/when we create the generation system.
Pelotonia riders come from real countries around the world as well as eventually Pelotonia itself.
The portrait population should represent broad global human diversity.
However, nationality must not deterministically define appearance.
Do not implement simplistic rules such as:
Denmark = blond/light skin
or
Japan = one fixed East Asian appearance.
Nationality and appearance should be separate concepts.
If demographic weighting is eventually used, it should be probabilistic and broad enough to represent multicultural populations realistically.
Riders have careers and age over time.
A 19-year-old should not necessarily look identical in age to a 37-year-old.
Architect the portrait system so we can eventually support age progression.
A possible model is:
-  Young 
-  Prime 
-  Veteran 
These should remain recognizably the same person, with the same fundamental facial identity.
Do not implement expensive automatic regeneration every game year unless there is a strong technical reason.
For now, investigate how we could preserve identity while supporting later age-stage portraits.
Once a rider has an established face, that face is part of the rider's persistent identity.
If Giovanni Declerq transfers to another team, he must not suddenly become another person.
Store portrait identity against the stable rider ID.
Generation should therefore be deterministic/persistent at the identity level even if an external image model is used.
Never regenerate a rider simply because a page reloads or the rider changes teams.
The current green jersey is acceptable for testing the art style, but it should not become baked permanently into rider identity if we can technically avoid that.
Long-term target:
permanent rider appearance + dynamic team kit
A rider transferring between teams should retain exactly the same face while appearing in the new team's jersey.
Pelotonia's planned monetisation includes:
-  free players: simple standard/solid-colour team jersey 
-  supporters: ability to design/customise their own team jersey 
Therefore investigate the best architecture for rendering the rider in the current team kit without requiring an entirely new facial identity.
Possible approaches may include:
-  separate jersey/body overlay 
-  masking/compositing 
-  controlled image editing 
-  generation using a persistent identity/reference image 
Choose based on visual quality, consistency, cost and technical robustness.
Do not return to the earlier low-quality modular face/sprite approach unless testing demonstrates that it can actually match the approved portrait quality.
The preferred production portrait asset should have a transparent background if the chosen generation pipeline supports this reliably.
The portrait itself should therefore be reusable in different UI contexts:
-  team page 
-  rider cards 
-  race viewer 
-  rankings 
-  results 
-  transfer/market screens 
-  special achievement cards 
The game UI, rather than the generated image, should ideally control the background.
If transparent generation is unreliable, investigate robust background-removal/post-processing as part of the pipeline.
Even with large human variation, portrait composition should remain consistent.
Target:
-  chest/upper torso visible 
-  face large enough for small UI cards 
-  similar camera distance 
-  mostly front-facing with a subtle approximately 5–15° turn allowed 
-  eyes clearly visible 
-  consistent lighting direction 
-  consistent visual rendering style 
-  no cropped-off heads 
-  no helmets 
-  no eyewear obscuring eyes 
Variation should come primarily from the person, not random camera styles.
Portrait generation must be an asset-generation process, not a frontend rendering dependency.
Expected lifecycle:
rider created → portrait identity generated once → asset stored → portrait reused
The game should serve stored/cached portrait assets during normal gameplay.
This is important for:
-  cost 
-  speed 
-  reliability 
-  identity consistency 
Do not tightly couple the rider system to one image provider.
We may evaluate models/providers such as FLUX or OpenAI image generation.
Build the eventual generation layer behind a provider abstraction so the image model can be replaced without rewriting rider/game logic.
Important selection criteria:
1.  portrait quality 
2.  stylistic consistency 
3.  identity consistency 
4.  male/female diversity 
5.  global human diversity 
6.  transparent-background or masking capability 
7.  ability to preserve identity for ageing/kit changes 
8.  generation cost 
9.  API reliability 
Cost matters, but visual quality and consistency matter more than finding the absolute cheapest provider.
Before implementing large-scale production portrait generation, perform a larger controlled visual test.
Target approximately 50–100 sample riders, balanced roughly equally between female and male riders.
The sample should deliberately test:
-  multiple skin tones 
-  many face shapes 
-  eye variation 
-  nose/mouth/jaw variation 
-  hair textures 
-  hair lengths 
-  hair colours 
-  baldness 
-  facial hair 
-  freckles/skin details 
-  young-looking riders 
-  mature/veteran-looking riders 
-  ordinary/common appearances 
-  a small number of rare/distinctive appearances 
Most samples should remain visually ordinary/plausible. Do not make the stress test a collection of eccentric characters.
Maintain the approved Pelotonia style throughout.
Evaluate whether the larger sample begins to expose:
-  repeated facial structures 
-  repeated noses/eyes/mouths 
-  same-face syndrome 
-  gender convergence 
-  repeated hairstyles 
-  demographic stereotypes 
-  inconsistent art style 
-  inconsistent framing 
-  inconsistent lighting 
-  uncanny or obviously AI-generated failures 
Report these problems rather than hiding weak samples.
I would rather know that the generation approach fails at 70 portraits than discover it after creating 20,000 riders.
Alongside the visual stress test, propose a production architecture covering:
-  portrait identity specification/seed 
-  rider → portrait association 
-  asset storage 
-  caching/CDN 
-  provider abstraction 
-  generation queue 
-  failure/retry handling 
-  duplicate detection 
-  moderation/validation of generated images 
-  team-kit handling 
-  transparent background/post-processing 
-  possible age progression 
-  regeneration/versioning rules 
-  approximate cost per 1,000 / 10,000 / 100,000 riders 
Do not introduce production database migrations or paid mass-generation without approval.
A rider's visual appearance should not imply sporting ability.
Do not make:
-  muscular-looking rider = high Strength 
-  thin rider = climber 
-  large rider = sprinter 
-  older-looking rider = necessarily weak 
Rider performance comes from game data.
Portraits represent identity, not a visual shortcut for stats.
Age and possibly broad athlete body composition may have subtle visual effects later, but sporting skills should not be visually encoded in a deterministic way.
Consider the latest 12 sample portraits to be:
PELOTONIA RIDER PORTRAIT ART DIRECTION V1 — APPROVED FOR FURTHER TESTING
They are not necessarily production assets and do not define the limits of human variation.
Preserve their overall rendering quality/style while expanding diversity substantially.
Do not mass-generate production riders yet.
Add this portrait work to the existing Pelotonia development backlog alongside the other tasks already assigned.
At the end of the stress test/investigation, report:
-  visual results 
-  representative contact sheets 
-  failure examples 
-  diversity/repetition assessment 
-  recommended image provider/model 
-  recommended portrait architecture 
-  recommended jersey solution 
-  recommended ageing solution 
-  expected generation/storage costs 
-  what should be implemented next 
Do not make unrelated game changes as part of this task.