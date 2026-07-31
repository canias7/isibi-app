import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MyopiaProgression } from "@/components/charts/lib/optical"
const readings = [
  { age: 7, sphere: -1 },
  { age: 8, sphere: -1.75 },
  { age: 9, sphere: -2.5 },
  { age: 10, sphere: -3.25 },
  { age: 11, sphere: -3.5 },
  { age: 12, sphere: -3.75 },
  { age: 13, sphere: -4 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Myopia control</CardTitle>
        <CardDescription>Against what it would have done untreated</CardDescription>
      </CardHeader>
      <CardContent>
        <MyopiaProgression readings={readings} expectedPerYear={-0.75} startedControlAt={10} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Still getting worse is not the same as not working <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Age 7 to 13
        </div>
      </CardFooter>
    </Card>
  )
}
