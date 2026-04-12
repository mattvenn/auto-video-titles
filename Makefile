COMPOSITIONS := LowerThirdVFD LowerThirdCallToAction TTLowerThird TTCallToAction Z2ATitleBar Z2ATitleBarV2 Z2ALogoAnim

.PHONY: render-all render-card studio clean

studio:
	npx remotion studio

render-all:
	mkdir -p out
	$(foreach comp,$(COMPOSITIONS),npx remotion render src/index.ts $(comp) out/$(comp).mov --codec=prores --prores-profile=4444;)

# Render a single card with custom props.
# Called by render_titles.py — do not invoke directly.
#   OUT        = output file path
#   PROPS_FILE = path to a JSON file containing {"line1":"...","line2":"..."}
clean:
	rm -rf out/

render-card:
	mkdir -p $(OUT)
	node render_frames.mjs --out=$(OUT) --props=$(PROPS_FILE) --composition=$(COMPOSITION)
