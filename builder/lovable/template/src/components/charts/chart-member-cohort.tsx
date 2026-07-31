import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MemberCohort } from "@/components/charts/lib/gym"
const cohorts = [
  { label: "January offer", joined: 412, surviving: [412, 371, 302, 241, 198, 168, 141, 121, 108, 96, 88, 81, 74] },
  { label: "February", joined: 186, surviving: [186, 172, 154, 138, 124, 112, 104, 96, 91, 86, 82, 78, 74] },
  { label: "March", joined: 148, surviving: [148, 139, 128, 118, 109, 102, 96, 91, 87, 84, 81, 78, 76] },
  { label: "September", joined: 264, surviving: [264, 248, 228, 211, 196, 184, 174, 166, 159, 153, 148, 143, 139] },
  { label: "Summer walk-in", joined: 96, surviving: [96, 78, 58, 44, 34, 28, 24, 21, 19, 17, 16, 15, 14] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Joiner cohorts</CardTitle>
        <CardDescription>Each intake on its own clock</CardDescription>
      </CardHeader>
      <CardContent>
        <MemberCohort cohorts={cohorts} monthlyFee={34} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A monthly churn figure averages these together <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five intakes
        </div>
      </CardFooter>
    </Card>
  )
}
