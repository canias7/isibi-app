import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WeightTrack } from "@/components/charts/lib/vet"
const readings = [
  { date: "Mar 22", kg: 31.4 },
  { date: "Sep 22", kg: 33.1 },
  { date: "Mar 23", kg: 34.6 },
  { date: "Sep 23", kg: 33.8 },
  { date: "Mar 24", kg: 31.2 },
  { date: "Sep 24", kg: 28.6 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight</CardTitle>
        <CardDescription>The direction, not the number</CardDescription>
      </CardHeader>
      <CardContent>
        <WeightTrack readings={readings} breedMinKg={25} breedMaxKg={32} animal="Bramble" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Inside the range and falling is the one to watch <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Bramble, labrador, six visits
        </div>
      </CardFooter>
    </Card>
  )
}
