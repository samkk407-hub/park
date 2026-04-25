import { Router, Request, Response } from "express";
import { authMiddleware } from "../lib/auth";
import { getRequiredEnv } from "../lib/config";

const router = Router();

const DEFAULT_PLACES_BASE = "https://places.googleapis.com/v1";

type GoogleAutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
};

type GooglePlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  addressComponents?: {
    longText?: string;
    shortText?: string;
    types?: string[];
  }[];
};

function getPlacesBaseUrl() {
  return (process.env["GOOGLE_PLACES_API_BASE"] || DEFAULT_PLACES_BASE).replace(/\/$/, "");
}

function getAddressPart(place: GooglePlaceDetailsResponse, types: string[]) {
  return place.addressComponents?.find((component) =>
    types.some((type) => component.types?.includes(type)),
  )?.longText || "";
}

router.get("/autocomplete", authMiddleware, async (req: Request, res: Response) => {
  const input = String(req.query["input"] || "").trim();
  if (input.length < 2) return res.json({ suggestions: [] });

  const apiKey = getRequiredEnv("GOOGLE_MAPS_API_KEY");
  const response = await fetch(`${getPlacesBaseUrl()}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input,
      languageCode: "en",
      includedRegionCodes: ["in"],
    }),
  });

  const data = await response.json() as GoogleAutocompleteResponse & { error?: { message?: string } };
  if (!response.ok) {
    return res.status(response.status).json({ error: data.error?.message || "Location autocomplete failed" });
  }

  const suggestions = (data.suggestions || [])
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId))
    .map((prediction) => ({
      placeId: prediction.placeId,
      description: prediction.text?.text || "",
      mainText: prediction.structuredFormat?.mainText?.text || prediction.text?.text || "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text || "",
    }))
    .filter((item) => item.description);

  return res.json({ suggestions });
});

router.get("/details/:placeId", authMiddleware, async (req: Request, res: Response) => {
  const placeId = String(req.params["placeId"] || "").trim();
  if (!placeId) return res.status(400).json({ error: "placeId is required" });

  const apiKey = getRequiredEnv("GOOGLE_MAPS_API_KEY");
  const response = await fetch(`${getPlacesBaseUrl()}/places/${encodeURIComponent(placeId)}?languageCode=en`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
  });

  const place = await response.json() as GooglePlaceDetailsResponse & { error?: { message?: string } };
  if (!response.ok) {
    return res.status(response.status).json({ error: place.error?.message || "Location details failed" });
  }

  const city = getAddressPart(place, [
    "locality",
    "administrative_area_level_3",
    "sublocality",
  ]);
  const state = getAddressPart(place, ["administrative_area_level_1"]);

  return res.json({
    location: {
      placeId: place.id || placeId,
      address: place.formattedAddress || "",
      city,
      state,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
    },
  });
});

export default router;
