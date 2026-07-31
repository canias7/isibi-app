import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Rarefaction } from "@/components/charts/lib/ecology"
const abundances = [184, 112, 41, 27, 14, 10, 6, 4, 3, 3, 2, 2, 1, 1, 1, 1]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rarefaction</CardTitle>
        <CardDescription>Expected richness at any sampling depth</CardDescription>
      </CardHeader>
      <CardContent>
        <Rarefaction abundances={abundances} compareAt={120} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The honest way to compare unequal samples <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Hurlbert
        </div>
      </CardFooter>
    </Card>
  )
}
