import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BlastRadius } from "@/components/charts/lib/socops"
const assets = [
  { id: "laptop", label: "Finance laptop", value: 1 },
  { id: "share", label: "Finance share", value: 8, tier: "internal" },
  { id: "sso", label: "SSO session", value: 12 },
  { id: "crm", label: "CRM", value: 30, tier: "customer data" },
  { id: "erp", label: "ERP", value: 40, tier: "financial" },
  { id: "wiki", label: "Wiki", value: 4 },
  { id: "src", label: "Source control", value: 34, tier: "IP" },
  { id: "prod", label: "Production", value: 90, tier: "crown jewel" },
  { id: "hsm", label: "Signing HSM", value: 100, tier: "crown jewel" },
]
const trusts = [
  { from: "laptop", to: "share" }, { from: "laptop", to: "sso" },
  { from: "sso", to: "crm" }, { from: "sso", to: "wiki" }, { from: "sso", to: "erp" },
  { from: "erp", to: "src" }, { from: "src", to: "prod" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Blast radius</CardTitle>
        <CardDescription>Everything one account can reach, walked</CardDescription>
      </CardHeader>
      <CardContent>
        <BlastRadius assets={assets} trusts={trusts} compromised="laptop" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One asset out of reach is the segmentation working <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          From a laptop
        </div>
      </CardFooter>
    </Card>
  )
}
