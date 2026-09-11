import { NextResponse } from "next/server";
import { listRuntimeModels } from "@/lib/model-store";
import { creditsFromUsd, getInternalUsdPkr } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  const [models, fxRate] = await Promise.all([listRuntimeModels(), getInternalUsdPkr()]);
  return NextResponse.json({
    models: models.map((model) => ({
      id: model.id,
      name: model.name,
      providerFamily: model.providerFamily,
      tier: model.tier,
      modality: model.modality,
      description: model.description,
      capabilities: model.capabilities,
      uiSchema: model.uiSchema,
      autoEligible: model.autoEligible !== false,
      retail: {
        inputPerMillionCredits: model.inputUsdPerMillion ? creditsFromUsd(model.inputUsdPerMillion, model.markup, fxRate) : undefined,
        outputPerMillionCredits: model.outputUsdPerMillion ? creditsFromUsd(model.outputUsdPerMillion, model.markup, fxRate) : undefined,
        flatCredits: model.flatUsd ? creditsFromUsd(model.flatUsd, model.markup, fxRate) : undefined,
        perSecondCredits: model.perSecondUsd ? creditsFromUsd(model.perSecondUsd, model.markup, fxRate) : undefined,
        per1kCharsCredits: model.per1kCharsUsd ? creditsFromUsd(model.per1kCharsUsd, model.markup, fxRate) : undefined
      }
    }))
  });
}

