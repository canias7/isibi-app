import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RankAbundance } from "@/components/charts/lib/ecology"
const species = [
  { name: "P. melanarius", count: 1840 }, { name: "N. brevicollis", count: 1120 },
  { name: "C. nemoralis", count: 410 }, { name: "A. parallelepipedus", count: 268 },
  { name: "H. rufipes", count: 141 }, { name: "L. pilicornis", count: 96 },
  { name: "B. lampros", count: 61 }, { name: "T. quadristriatus", count: 34 },
  { name: "A. aenea", count: 18 }, { name: "S. vaporariorum", count: 11 },
  { name: "D. globosus", count: 6 }, { name: "L. ferrugineus", count: 3 },
  { name: "P. cupreus", count: 1 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rank abundance</CardTitle>
        <CardDescription>A Whittaker plot of the whole catch</CardDescription>
      </CardHeader>
      <CardContent>
        <RankAbundance species={species} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two species are three quarters of it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Log abundance
        </div>
      </CardFooter>
    </Card>
  )
}
