const getDateTimeDetails = () => {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthIndex = now.getMonth();
  const monthName = months[monthIndex];
  const year = now.getFullYear();

  const formattedDate = `${day}-${monthName}-${year}`;

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours || 12;

  const formattedTime = `${hours}:${minutes} ${ampm}`;

  return {
    date_time: now,
    date: formattedDate,
    time: formattedTime,
    month: monthIndex + 1,
    year: year,
  };
};

module.exports = { getDateTimeDetails };
