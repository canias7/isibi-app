import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PunnettSquare } from "@/components/charts/lib/biolang"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monohybrid cross</CardTitle>
        <CardDescription>Two heterozygous parents</CardDescription>
      </CardHeader>
      <CardContent>
        <PunnettSquare a={["A", "a"]} b={["A", "a"]} dominant="A" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The ratio is counted off the grid <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Dominant allele A
        </div>
      </CardFooter>
    </Card>
  )
}
