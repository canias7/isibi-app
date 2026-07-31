import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WasteComposition } from "@/components/charts/lib/waste"
const materials = [
  { name: "Food waste", percent: 28.4, collectedKerbside: true },
  { name: "Non-recyclable plastic", percent: 14.1, collectedKerbside: false },
  { name: "Card and paper", percent: 12.6, collectedKerbside: true },
  { name: "Textiles", percent: 9.2, collectedKerbside: false },
  { name: "Garden waste", percent: 8.1, collectedKerbside: true },
  { name: "Glass", percent: 6.4, collectedKerbside: true },
  { name: "Nappies and hygiene", percent: 11.8, collectedKerbside: false },
  { name: "Plastic bottles", percent: 4.2, collectedKerbside: true },
  { name: "Other", percent: 5.2, collectedKerbside: false },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Residual bin</CardTitle>
        <CardDescription>How much of it already has a collection</CardDescription>
      </CardHeader>
      <CardContent>
        <WasteComposition materials={materials} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A new service cannot recover the hatched part <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Kerbside audit
        </div>
      </CardFooter>
    </Card>
  )
}
