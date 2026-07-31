import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FeedConversion } from "@/components/charts/lib/aquaculture"
const pens = [
  { name: "Pen 1", feedT: 812, gainT: 690, mortalityT: 18 },
  { name: "Pen 2", feedT: 934, gainT: 742, mortalityT: 61 },
  { name: "Pen 3", feedT: 776, gainT: 664, mortalityT: 12 },
  { name: "Pen 4", feedT: 1042, gainT: 796, mortalityT: 94 },
  { name: "Pen 5", feedT: 868, gainT: 712, mortalityT: 34 },
  { name: "Pen 6", feedT: 902, gainT: 748, mortalityT: 22 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feed conversion</CardTitle>
        <CardDescription>Biological against economic</CardDescription>
      </CardHeader>
      <CardContent>
        <FeedConversion pens={pens} feedCostPerT={1640} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The fish that died had already eaten <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One cycle
        </div>
      </CardFooter>
    </Card>
  )
}
