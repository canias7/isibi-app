import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SitePhasing } from "@/components/charts/lib/archaeology"
const phases = [
  { name: "Phase 1 · enclosure", from: -350, to: -50, evidence: "Two radiocarbon dates on charred grain", confidence: "secure" as const },
  { name: "Phase 2 · roundhouses", from: -50, to: 70, evidence: "Pottery, one date", confidence: "probable" as const },
  { name: "Phase 3 · Roman farm", from: 120, to: 380, evidence: "Coins, samian", confidence: "secure" as const },
  { name: "Phase 4 · abandonment", from: 380, to: 640, evidence: "Stratigraphy only", confidence: "inferred" as const },
  { name: "Phase 5 · field system", from: 900, to: 1150, evidence: "Pottery", confidence: "probable" as const },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupation phases</CardTitle>
        <CardDescription>Each phase and the evidence behind it</CardDescription>
      </CardHeader>
      <CardContent>
        <SitePhasing phases={phases} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The gap is as real as the phases <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Iron Age to medieval
        </div>
      </CardFooter>
    </Card>
  )
}
