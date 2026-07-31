import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpectrumAllocation } from "@/components/charts/lib/telecom"
const assignments = [
  { holder: "Operator A", fromMhz: 703, toMhz: 713, service: "LTE uplink" },
  { holder: "Operator B", fromMhz: 713, toMhz: 723, service: "LTE uplink" },
  { holder: "Operator C", fromMhz: 723, toMhz: 733, service: "LTE uplink" },
  { holder: "PPDR", fromMhz: 738, toMhz: 753, service: "Emergency services" },
  { holder: "Operator A", fromMhz: 758, toMhz: 768, service: "LTE downlink" },
  { holder: "Operator B", fromMhz: 768, toMhz: 778, service: "LTE downlink" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spectrum</CardTitle>
        <CardDescription>Assignments across the band</CardDescription>
      </CardHeader>
      <CardContent>
        <SpectrumAllocation bandLowMhz={694} bandHighMhz={790} assignments={assignments} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The gaps are guard bands, not spare capacity <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          700 MHz
        </div>
      </CardFooter>
    </Card>
  )
}
