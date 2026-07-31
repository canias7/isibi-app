import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HoneyExtraction } from "@/components/charts/lib/apiary"
const batches = [
  { name: "Spring blossom", supers: 8, grossKg: 96.4, moisturePercent: 17.2 },
  { name: "Oilseed rape", supers: 11, grossKg: 148.9, moisturePercent: 16.4 },
  { name: "Bramble, early", supers: 6, grossKg: 61.2, moisturePercent: 21.4 },
  { name: "Lime", supers: 4, grossKg: 44.8, moisturePercent: 18.1 },
  { name: "Heather", supers: 5, grossKg: 38.6, moisturePercent: 19.6 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extraction</CardTitle>
        <CardDescription>Gross against what can be sold</CardDescription>
      </CardHeader>
      <CardContent>
        <HoneyExtraction batches={batches} maxMoisture={20} pricePerKg={11.5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A super is not a jar until it passes the refractometer <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Summer crop
        </div>
      </CardFooter>
    </Card>
  )
}
