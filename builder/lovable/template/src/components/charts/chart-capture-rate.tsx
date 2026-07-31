import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CaptureRate } from "@/components/charts/lib/waste"
const materials = [
  { name: "Garden waste", arisingT: 18400, capturedT: 15600, valuePerT: 8 },
  { name: "Paper and card", arisingT: 12100, capturedT: 7900, valuePerT: 82 },
  { name: "Glass", arisingT: 6800, capturedT: 4900, valuePerT: 24 },
  { name: "Metals", arisingT: 2100, capturedT: 1180, valuePerT: 190 },
  { name: "Plastic bottles", arisingT: 3400, capturedT: 1420, valuePerT: 240 },
  { name: "Textiles", arisingT: 4900, capturedT: 380, valuePerT: 120 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Capture rate</CardTitle>
        <CardDescription>Per material, because the heaviest sets the headline</CardDescription>
      </CardHeader>
      <CardContent>
        <CaptureRate materials={materials} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A headline rate is the wrong target <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Annual tonnage
        </div>
      </CardFooter>
    </Card>
  )
}
