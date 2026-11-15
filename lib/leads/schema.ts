import { z } from "zod";

export const leadSubmitSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(120),
  email: z.string().trim().email("Некорректный email").max(200),
  phone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(4000).optional().default(""),
  projectId: z.number().int().nullable().optional(),
  projectName: z.string().trim().max(300).nullable().optional(),
  offerId: z.string().uuid().optional(),
  salesRevision: z.number().int().positive().optional(),
  locale: z.enum(["en", "ru"]),
  consent: z.literal(true, { error: "Необходимо согласие на обработку персональных данных" }),
}).superRefine((v,ctx)=>{if((v.offerId||v.salesRevision)&&(!v.offerId||!v.salesRevision||v.projectId==null))ctx.addIssue({code:"custom",message:"Выберите предложение заново",path:["offerId"]});});
