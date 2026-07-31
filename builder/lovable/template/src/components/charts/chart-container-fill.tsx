import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ContainerFill } from "@/components/charts/lib/logistics"
const containers = [
  { ref: "MSKU1042", cubeUsed: 58, cubeCap: 67, kgUsed: 18400, kgCap: 26000 },
  { ref: "MSKU1088", cubeUsed: 31, cubeCap: 67, kgUsed: 24900, kgCap: 26000 },
  { ref: "TGHU2201", cubeUsed: 66, cubeCap: 67, kgUsed: 9200, kgCap: 26000 },
  { ref: "TGHU2310", cubeUsed: 40, cubeCap: 67, kgUsed: 11800, kgCap: 26000 },
  { ref: "CSQU3054", cubeUsed: 22, cubeCap: 67, kgUsed: 6400, kgCap: 26000 },
  { ref: "CSQU3099", cubeUsed: 61, cubeCap: 67, kgUsed: 21200, kgCap: 26000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How much air shipped</CardTitle>
        <CardDescription>Cube against weight</CardDescription>
      </CardHeader>
      <CardContent>
        <ContainerFill containers={containers} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A container costs the same half empty <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Last ten boxes
        </div>
      </CardFooter>
    </Card>
  )
}
