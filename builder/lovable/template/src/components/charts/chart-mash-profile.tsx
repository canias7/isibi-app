import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MashProfile } from "@/components/charts/lib/brewing"
const steps = [
  { name: "Acid rest", minute: 0, celsius: 45 },
  { name: "Protein rest", minute: 20, celsius: 52 },
  { name: "Beta amylase", minute: 40, celsius: 63 },
  { name: "Alpha amylase", minute: 80, celsius: 72 },
  { name: "Mash out", minute: 100, celsius: 78 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mash schedule</CardTitle>
        <CardDescription>Rest temperatures and how long each is held</CardDescription>
      </CardHeader>
      <CardContent>
        <MashProfile steps={steps} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The saccharification rest does the work <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Step mash
        </div>
      </CardFooter>
    </Card>
  )
}
