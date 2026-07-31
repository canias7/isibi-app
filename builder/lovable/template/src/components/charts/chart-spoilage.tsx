import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spoilage } from "@/components/charts/lib/printing"
const causes = [
  { name: "Press makeready", percent: 0, fixed: 250 },
  { name: "Running waste", percent: 2.5 },
  { name: "Folding", percent: 1.8, fixed: 60 },
  { name: "Binding", percent: 2.2, fixed: 80 },
  { name: "Trimming", percent: 1.1 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spoilage</CardTitle>
        <CardDescription>Worked back from the copies wanted</CardDescription>
      </CardHeader>
      <CardContent>
        <Spoilage netCopies={5000} causes={causes} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Adding the percentages buys too little paper <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five stages
        </div>
      </CardFooter>
    </Card>
  )
}
