import { z } from "zod";
import { catalogProjectSchema } from "./schema";
import { locationEvidenceSchema } from "./project-location";

const publication = z.object({
  available:z.number().int().positive(),observedAt:z.iso.date(),expiresAt:z.iso.datetime(),coverage:z.literal("published-offers"),
  fromPrice:z.object({amount:z.number().positive(),currency:z.string().length(3),ownership:z.string(),priceDate:z.iso.date()}).optional(),
  pricing:z.array(z.object({currency:z.string().length(3),ownership:z.string(),bedrooms:z.number().int().nullable(),from:z.number().positive()})).optional(),
});
export const mapSnapshotSchema = z.object({
  version:z.literal(1),downloadedAt:z.iso.datetime(),
  projects:z.array(catalogProjectSchema.pick({id:true,n:true,dev:true,dt:true,zone:true,seg:true,type:true,tags:true,stK:true,compY:true,pN:true}).extend({
    slug:z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),description:z.string().max(4000),completion:z.string().max(200),bedrooms:z.number().int().nullable(),dataConfirmedAt:z.iso.datetime({offset:true}).nullable(),
    location:locationEvidenceSchema.optional(),sales:z.object({publication}).optional(),
  })).max(10000),
});
