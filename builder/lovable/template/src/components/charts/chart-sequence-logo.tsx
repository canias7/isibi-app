import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SequenceLogo } from "@/components/charts/lib/biolang"
const motif = [
  { A: 0.3, C: 0.28, G: 0.24, T: 0.18 },
  { A: 0.62, C: 0.14, G: 0.14, T: 0.1 },
  { A: 0.08, C: 0.06, G: 0.78, T: 0.08 },
  { A: 0.01, C: 0.01, G: 0.97, T: 0.01 },
  { A: 0.02, C: 0.94, G: 0.02, T: 0.02 },
  { A: 0.12, C: 0.2, G: 0.18, T: 0.5 },
  { A: 0.26, C: 0.26, G: 0.24, T: 0.24 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Binding motif</CardTitle>
        <CardDescription>Letter height is information, not frequency</CardDescription>
      </CardHeader>
      <CardContent>
        <SequenceLogo positions={motif} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Positions 4 and 5 are fully conserved <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Bits, over four bases
        </div>
      </CardFooter>
    </Card>
  )
}
