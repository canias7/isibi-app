import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PhylogeneticTree } from "@/components/charts/lib/biolang"
const tree = {
  children: [
    {
      length: 0.2,
      children: [
        { length: 0.5, label: "Human" },
        { length: 0.48, label: "Chimp" },
      ],
    },
    {
      length: 0.15,
      children: [
        { length: 0.62, label: "Mouse" },
        {
          length: 0.3,
          children: [
            { length: 0.44, label: "Chicken" },
            { length: 0.58, label: "Lizard" },
          ],
        },
      ],
    },
  ],
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Phylogeny</CardTitle>
        <CardDescription>Branch length is evolutionary distance</CardDescription>
      </CardHeader>
      <CardContent>
        <PhylogeneticTree root={tree} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Tips do not line up, and that is the point <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Schematic
        </div>
      </CardFooter>
    </Card>
  )
}
