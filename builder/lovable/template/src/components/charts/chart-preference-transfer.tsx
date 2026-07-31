import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PreferenceTransfer } from "@/components/charts/lib/civic"
const rounds = [
  [
    { candidate: "Okonkwo", votes: 14200 }, { candidate: "Brandt", votes: 12850 },
    { candidate: "Sørensen", votes: 9600 }, { candidate: "Aziz", votes: 6100 },
    { candidate: "Whitlock", votes: 2450 },
  ],
  [
    { candidate: "Okonkwo", votes: 15010 }, { candidate: "Brandt", votes: 13420 },
    { candidate: "Sørensen", votes: 10380 }, { candidate: "Aziz", votes: 6390 },
  ],
  [
    { candidate: "Okonkwo", votes: 17240 }, { candidate: "Brandt", votes: 15100 },
    { candidate: "Sørensen", votes: 12860 },
  ],
  [
    { candidate: "Okonkwo", votes: 24180 }, { candidate: "Brandt", votes: 21020 },
  ],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Counting the preferences</CardTitle>
        <CardDescription>Round by round</CardDescription>
      </CardHeader>
      <CardContent>
        <PreferenceTransfer rounds={rounds} seats={1} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Reaching quota wins, not leading <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Single seat
        </div>
      </CardFooter>
    </Card>
  )
}
