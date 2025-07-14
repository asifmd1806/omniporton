import { TemplateRegistry } from './TemplateRegistry';
import * as templates from "./templates";

export const templateRegistry = new TemplateRegistry();

// Register built-in templates (alphabetical order)
templateRegistry.registerTemplate("alpaca", { ...templates.alpacaTemplate });
templateRegistry.registerTemplate("chatml", { ...templates.chatmlTemplate });
templateRegistry.registerTemplate("codellama", { ...templates.codellamaTemplate });
templateRegistry.registerTemplate("command-r", { ...templates.commandRTemplate });
templateRegistry.registerTemplate("falcon", { ...templates.falconTemplate });
templateRegistry.registerTemplate("gemma", { ...templates.gemmaTemplate });
templateRegistry.registerTemplate("gemma3", { ...templates.gemma3Template });
templateRegistry.registerTemplate("granite", { ...templates.graniteTemplate });
templateRegistry.registerTemplate("llama2", { ...templates.llama2Template });
templateRegistry.registerTemplate("llama3", { ...templates.llama3Template });
templateRegistry.registerTemplate("magicoder", { ...templates.magicoderTemplate });
templateRegistry.registerTemplate("mistral", { ...templates.mistralTemplate });
templateRegistry.registerTemplate("openchat", { ...templates.openchatTemplate });
templateRegistry.registerTemplate("phi-3", { ...templates.phi3Template });
templateRegistry.registerTemplate("solar", { ...templates.solarTemplate });
templateRegistry.registerTemplate("starcoder2", { ...templates.starcoder2Template });
templateRegistry.registerTemplate("starcoder2-instruct", { ...templates.starcoder2InstructTemplate });
templateRegistry.registerTemplate("vicuna", { ...templates.vicunaTemplate });
templateRegistry.registerTemplate("zephyr", { ...templates.zephyrTemplate });