import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VoteTransfer } from "@/components/charts/lib/elections"
const destinations = [
  { to: "Okonkwo", votes: 2840 },
  { to: "Prentice", votes: 1960 },
  { to: "Vasquez", votes: 1210 },
  { to: "Aldridge", votes: 640 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preference transfer</CardTitle>
        <CardDescription>Where an eliminated candidate's votes went</CardDescription>
      </CardHeader>
      <CardContent>
        <VoteTransfer from="Halloran" fromVotes={8100} destinations={destinations} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An exhausted ballot is not a vote for nobody <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Count 4
        </div>
      </CardFooter>
    </Card>
  )
}
