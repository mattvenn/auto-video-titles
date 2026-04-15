COMPOSITIONS := LowerThirdVFD LowerThirdCallToAction TTLowerThird TTCallToAction TTTopicCard Z2ATitleBar Z2ATitleBarV2 Z2ALogoAnim Z2AIntro Z2AIntroLogoExpand

.PHONY: render-all render-card studio clean gen-video-list

gen-video-list:
	node scripts/gen-video-list.mjs

studio: gen-video-list
	npx remotion studio

render-all: gen-video-list
	mkdir -p out
	$(foreach comp,$(COMPOSITIONS),npx remotion render src/index.ts $(comp) out/$(comp).mov --codec=prores --prores-profile=4444;)

# Render a single card with custom props.
# Called by render_titles.py — do not invoke directly.
#   OUT        = output file path
#   PROPS_FILE = path to a JSON file containing {"line1":"...","line2":"..."}
clean:
	rm -rf out/

render-card:
	rm -rf $(OUT)
	mkdir -p $(OUT)
	node render_frames.mjs --out=$(OUT) --props=$(PROPS_FILE) --composition=$(COMPOSITION)
